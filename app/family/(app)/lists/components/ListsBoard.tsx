"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createList, deleteList, updateList } from "@/lib/family/actions/lists";
import { uncheckedCountOf } from "@/lib/family/lists/grouping";
import { rowLayoutOf } from "@/lib/family/lists/layout";
import { itemsShownOf, visibleListsOf } from "@/lib/family/lists/visibility";
import { useListItems, useLists } from "@/lib/family/queries";
import type { ActorSession, List, ListItem } from "@/lib/family/types";
import type { ListInput } from "@/lib/family/validation";

import { BoardNotice } from "../../components/BoardNotice";
import { useColumnPage } from "../../components/ColumnPager";
import { useRegisterFabAction } from "../../components/FabAction";
import { useFamily, type FamilyContextValue } from "../../components/FamilyProvider";
import { PagedColumns, type PagedColumn } from "../../components/PagedColumns";
import { useBoardGeometry } from "../../components/useBoardGeometry";
import { settleEdit, useWriteSurface } from "../../components/useWriteSurface";
import { ConfirmDialog } from "./ConfirmDialog";
import { ListCard } from "./ListCard";
import { ListForm } from "./ListForm";
import { ListMenu, type ListMenuEntry } from "./ListMenu";
import { listDraftOf, type ListSubmitOutcome } from "./useListForm";
import { useListFilters } from "./useListFilters";
import { useListWrites, type ListWrites } from "./useListWrites";

/**
 * 005 T027: the Lists tab — FR-502's row of cards, on the shipped board chassis
 * (R507), which now lives in `components/` because this is its third consumer:
 *
 *   useBoardGeometry      measures the strip against `--fam-list-card-w`, and
 *                         applies `rowLayoutOf` — whole cards or a pager, never
 *                         a second row (FR-502, Assumption 11)
 *   useColumnPage         which window of cards is on screen (FR-543)
 *   ColumnPager           the swipe and the arrow keys between windows
 *   BoardStrip            the grid both boards mount
 *   useListFilters        the per-device Completed switch (FR-520)
 *
 * **The columns are the visible lists, in the household's order** — every list
 * of the household when a parent is punched in on this device, and every list
 * that is not Parents only otherwise (`visibleListsOf`, FR-514, R505). A list
 * that leaves the visible set while a sheet is open on it — a parent punched
 * out — closes that sheet without a word; one that leaves the household says
 * so, once (FR-393's rule).
 *
 * **The tab holds the household's two reads once** (R506) and hands every card
 * ITS items: the FULL set for the badge and the section counts, the SHOWN set
 * for the rows, so the device's Completed switch never moves a number (FR-505).
 *
 * **The model is split from the start** (plan §V): `useListsView` is the tab's
 * own state before any data, `useListsData` the two reads and the two filters,
 * `useListEditor` the list-level write surface (create, edit, delete, clear,
 * the menu), and `useListWrites` the item queue. Every commit goes through the
 * shipped `withActor` interceptor — the punch-in at the tap (FR-534) — and
 * nothing is written to the cache by hand: the tab repaints from the refetch
 * (FR-537).
 */

/** What the shell's "+" is called on this tab, and what it opens (FR-507). */
const FAB_LABEL = "Add List";

/** A failed read says so once, in the household's words, not the API's. */
const READ_FAILED = "Lists could not be loaded.";

/** The open surface's list went away underneath it (FR-393). */
const GONE_MESSAGE = "That list is no longer here.";

/** FR-508: no visible list — and never a word about hidden ones. */
const NO_LISTS = "No lists yet";

/* ------------------------------------------------------------------ data -- */

export interface ListsBoardProps {
  /** The two reads the server performed (R506), each seeded to its own key. */
  initialLists: List[];
  initialItems: ListItem[];
}

const NO_LIST_ROWS: List[] = [];
const NO_ITEM_ROWS: ListItem[] = [];
const NO_ITEMS: readonly ListItem[] = [];

interface ListsData {
  /** Every list of the household, hidden ones included — the gone-check reads it. */
  all: readonly List[];
  /** The lists this device draws, in the household's order (FR-514). */
  lists: readonly List[];
  /** Every item, by list. */
  itemsByList: ReadonlyMap<string, ListItem[]>;
  /** The items this device draws, by list (FR-520). */
  shownByList: ReadonlyMap<string, ListItem[]>;
  error: Error | null;
}

function groupByList(items: readonly ListItem[]): Map<string, ListItem[]> {
  const byList = new Map<string, ListItem[]>();
  for (const item of items) {
    const group = byList.get(item.listId);
    if (group === undefined) byList.set(item.listId, [item]);
    else group.push(item);
  }
  return byList;
}

/** The two reads, the role filter over the lists, and the device filter over the items. */
function useListsData(
  householdId: string,
  props: ListsBoardProps,
  actor: ActorSession | null,
  completed: boolean,
): ListsData {
  const lists = useLists(householdId, props.initialLists);
  const items = useListItems(householdId, props.initialItems);
  const all = lists.data ?? NO_LIST_ROWS;
  const rows = items.data ?? NO_ITEM_ROWS;

  const visible = useMemo(() => visibleListsOf(all, actor), [all, actor]);
  const itemsByList = useMemo(() => groupByList(rows), [rows]);
  const shownByList = useMemo(
    () => groupByList(itemsShownOf(rows, { completed })),
    [rows, completed],
  );

  return { all, lists: visible, itemsByList, shownByList, error: lists.error ?? items.error };
}

/* ------------------------------------------------------------------ view -- */

/** The tab's own state before any data: how many cards fit, which page, the switch. */
function useListsView(columnCount: number) {
  const geometry = useBoardGeometry(columnCount, {
    widthToken: "--fam-list-card-w",
    layoutOf: rowLayoutOf,
  });
  const page = useColumnPage({
    columnCount,
    perRow: geometry.layout.perRow,
    mode: geometry.layout.mode,
  });
  const filters = useListFilters();
  return { layout: geometry.layout, boardRef: geometry.boardRef, page, filters };
}

/* ----------------------------------------------------------- write surface -- */

/** Which list-level surface is open. One at a time: the menu hands over to the others. */
type ListSurface =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; list: List }
  | { kind: "menu"; list: List }
  | { kind: "delete"; list: List }
  | { kind: "clear"; list: List };

const SURFACE_CLOSED: ListSurface = { kind: "closed" };

/** The list an open surface is about, if any. */
function surfaceListOf(surface: ListSurface): List | null {
  return surface.kind === "closed" || surface.kind === "create" ? null : surface.list;
}

interface ListEditor {
  surface: ListSurface;
  notice: string | null;
  clearNotice: () => void;
  /** FR-393: the list left before its write landed — the board says so, once. */
  reportGone: () => void;
  /** The list left the visible set (a parent punched out): close, and say nothing. */
  closeQuietly: () => void;
  busy: boolean;
  openCreate: () => void;
  openEdit: (list: List) => void;
  openMenu: (list: List) => void;
  openDelete: (list: List) => void;
  openClear: (list: List) => void;
  close: () => void;
  /** The form's commit: create, or the merged patch of the open edit. */
  submit: (input: ListInput) => Promise<ListSubmitOutcome>;
  /** FR-512: after the confirmation — the one delete made from here. */
  remove: () => Promise<void>;
  /** FR-521: after the confirmation — through the item queue's write. */
  clear: () => Promise<void>;
}

function useListEditor(withActor: FamilyContextValue["withActor"], writes: ListWrites): ListEditor {
  const { surface, notice, open, close, clearNotice, reportGone, setNotice } =
    useWriteSurface<ListSurface>(SURFACE_CLOSED, GONE_MESSAGE);
  const [busy, setBusy] = useState(false);

  const openCreate = useCallback(() => open({ kind: "create" }), [open]);
  const openEdit = useCallback((list: List) => open({ kind: "edit", list }), [open]);
  const openMenu = useCallback((list: List) => open({ kind: "menu", list }), [open]);
  const openDelete = useCallback((list: List) => open({ kind: "delete", list }), [open]);
  const openClear = useCallback((list: List) => open({ kind: "clear", list }), [open]);

  const submit = useCallback(
    async (input: ListInput): Promise<ListSubmitOutcome> => {
      if (surface.kind === "create") return withActor(() => createList(input));
      if (surface.kind !== "edit") return null;
      return settleEdit(
        () => withActor(() => updateList({ id: surface.list.id, patch: input })),
        reportGone,
      );
    },
    [surface, withActor, reportGone],
  );

  const remove = useCallback(async () => {
    if (surface.kind !== "delete" || busy) return;
    setBusy(true);
    const result = await withActor(() => deleteList({ id: surface.list.id, confirm: true }));
    setBusy(false);
    if (result.ok) close();
    else if (result.error === "NOT_FOUND") reportGone();
    else if (result.error !== "NO_ACTOR") setNotice(result.message);
  }, [surface, busy, withActor, close, reportGone, setNotice]);

  const clear = useCallback(async () => {
    if (surface.kind !== "clear") return;
    const list = surface.list;
    close();
    // The refusal, if any, is the item queue's notice — the board's one line.
    await writes.clearCompleted(list);
  }, [surface, close, writes]);

  return {
    surface,
    notice,
    clearNotice,
    reportGone,
    closeQuietly: close,
    busy,
    openCreate,
    openEdit,
    openMenu,
    openDelete,
    openClear,
    close,
    submit,
    remove,
    clear,
  };
}

/**
 * FR-393 and FR-514 together: a surface whose list has left the HOUSEHOLD says
 * so; one whose list has merely left this device's visible set (a parent
 * punched out of a Parents only list) closes without a word.
 */
function useSurfaceGoneCheck(editor: ListEditor, data: ListsData): void {
  const target = surfaceListOf(editor.surface);
  const { reportGone, closeQuietly } = editor;
  useEffect(() => {
    if (target === null) return;
    if (data.lists.some((list) => list.id === target.id)) return;
    if (data.all.some((list) => list.id === target.id)) closeQuietly();
    else reportGone();
  }, [target, data.lists, data.all, reportGone, closeQuietly]);
}

/* -------------------------------------------------------------- add boxes -- */

/** The cards' "Add item" boxes by list, so the menu's "Add item" can focus one (FR-516). */
function useAddBoxes() {
  const boxes = useRef(new Map<string, HTMLInputElement>());
  const register = useCallback((listId: string, node: HTMLInputElement | null) => {
    if (node === null) boxes.current.delete(listId);
    else boxes.current.set(listId, node);
  }, []);
  const focus = useCallback((listId: string) => boxes.current.get(listId)?.focus(), []);
  return { register, focus };
}

/* ------------------------------------------------------------------ menu -- */

/** The list menu's entries (R510): the reference's four, and this project's Delete. */
function menuEntriesOf(
  list: List,
  items: readonly ListItem[],
  editor: ListEditor,
  focusAddBox: (listId: string) => void,
  onAddSection: (list: List) => void,
): ListMenuEntry[] {
  const completed = completedCountOf(items);
  return [
    { label: "Add item", onSelect: () => focusAddBox(list.id) },
    { label: "Edit list", onSelect: () => editor.openEdit(list) },
    { label: "Add section", onSelect: () => onAddSection(list), disabled: items.length === 0 },
    {
      label: completed === 0 ? "Clear Completed" : `Clear Completed (${completed})`,
      onSelect: () => editor.openClear(list),
      disabled: completed === 0,
    },
    { label: "Delete list", onSelect: () => editor.openDelete(list), danger: true },
  ];
}

/* ----------------------------------------------------------------- model -- */

/**
 * The one line under the cards. A refused delete is shown by the board because
 * the confirmation has closed; a refused item write is the queue's notice.
 */
function noticeFor(data: ListsData, editor: ListEditor, writes: ListWrites): string | null {
  if (data.error !== null) return READ_FAILED;
  if (editor.notice !== null) return editor.notice;
  return writes.notice;
}

function useListsBoardModel(props: ListsBoardProps) {
  const { householdId, actor, withActor } = useFamily();
  const writes = useListWrites();
  const filters = useListFilters();
  const data = useListsData(householdId, props, actor, filters.filters.completed);
  const view = useListsView(data.lists.length);
  const editor = useListEditor(withActor, writes);
  const addBoxes = useAddBoxes();
  useSurfaceGoneCheck(editor, data);

  // The shell's one create control, named for this tab while it is mounted (FR-507).
  useRegisterFabAction(FAB_LABEL, editor.openCreate);

  // T043 wires the section sheet; until then the entry is drawn and disabled.
  const onAddSection = useCallback((): void => undefined, []);

  const onToggle = useCallback(
    (item: ListItem, checked: boolean) => void writes.setChecked(item, checked),
    [writes],
  );
  // T037 wires the item sheet.
  const onOpenItem = useCallback((): void => undefined, []);

  return {
    ...view,
    ...data,
    writes,
    editor,
    addBoxes,
    onAddSection,
    onToggle,
    onOpenItem,
    notice: noticeFor(data, editor, writes),
  };
}

type ListsBoardModel = ReturnType<typeof useListsBoardModel>;

/** Every card the tab has, in the household's order — the pager shows a window of it. */
function drawnColumnsOf(m: ListsBoardModel): PagedColumn[] {
  return m.lists.map((list) => ({
    label: list.name,
    node: (
      <ListCard
        key={list.id}
        list={list}
        items={m.itemsByList.get(list.id) ?? NO_ITEMS}
        shownItems={m.shownByList.get(list.id) ?? NO_ITEMS}
        busyKeys={m.writes.busyKeys}
        onAdd={m.writes.add}
        onToggle={m.onToggle}
        onOpenItem={m.onOpenItem}
        onEdit={m.editor.openEdit}
        onMenu={m.editor.openMenu}
        onAddSection={m.onAddSection}
        registerAddInput={m.addBoxes.register}
      />
    ),
  }));
}

/* ------------------------------------------------------------------ view -- */

/** "1 item" / "N items" — the confirmations' and the menu's count words. */
function itemsInWords(count: number, noun = "item"): string {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}

/** How many of a list's items are checked — what Clear Completed removes. */
function completedCountOf(items: readonly ListItem[]): number {
  return items.length - uncheckedCountOf(items);
}

/** FR-512's question: the list by name, and how many items go with it. */
function deleteTitleOf(list: List, count: number): string {
  const tail = count === 0 ? "" : ` and its ${itemsInWords(count)}`;
  return `Delete “${list.name}”${tail}?`;
}

/** The list-level surfaces: the form, the menu, the two confirmations — one at a time. */
function ListSurfaces({ m }: { m: ListsBoardModel }) {
  const { editor } = m;
  const { surface } = editor;
  const target = surfaceListOf(surface);
  const items = target === null ? NO_ITEMS : (m.itemsByList.get(target.id) ?? NO_ITEMS);
  if (surface.kind === "create" || surface.kind === "edit") {
    return (
      <ListForm
        mode={surface.kind}
        seed={target === null ? undefined : listDraftOf(target)}
        lists={m.all}
        excludeId={target?.id}
        onSubmit={editor.submit}
        onClose={editor.close}
      />
    );
  }
  if (surface.kind === "menu") {
    return (
      <ListMenu
        title={surface.list.name}
        entries={menuEntriesOf(surface.list, items, editor, m.addBoxes.focus, m.onAddSection)}
        onClose={editor.close}
      />
    );
  }
  if (surface.kind === "delete") {
    return (
      <ConfirmDialog
        title={deleteTitleOf(surface.list, items.length)}
        body="This can't be undone. Nothing else is affected."
        confirmLabel="Delete for good"
        pending={editor.busy}
        onConfirm={() => void editor.remove()}
        onCancel={editor.close}
      />
    );
  }
  if (surface.kind === "clear") {
    const completed = completedCountOf(items);
    return (
      <ConfirmDialog
        title={`Clear ${itemsInWords(completed, "completed item")} from ${surface.list.name}?`}
        body="The unchecked items stay exactly where they are. This can't be undone."
        confirmLabel={`Clear ${itemsInWords(completed)}`}
        onConfirm={() => void editor.clear()}
        onCancel={editor.close}
      />
    );
  }
  return null;
}

export function ListsBoard(props: ListsBoardProps) {
  const m = useListsBoardModel(props);

  return (
    <div className="flex h-full min-h-0 flex-col gap-(--fam-task-col-gap) pt-2">
      <BoardNotice notice={m.notice} />

      {m.lists.length === 0 ? (
        <p className="px-(--fam-edge-inset) text-(length:--fam-fs-body) text-(--fam-text-secondary)">
          {NO_LISTS}
        </p>
      ) : (
        // The window the measured layout allows: every card when they all fit, a page otherwise
        // (FR-502, FR-543) — the cards at the list gap, never the task column's.
        <PagedColumns
          page={m.page}
          boardRef={m.boardRef}
          perRow={m.layout.perRow}
          columns={drawnColumnsOf(m)}
          gapClassName="gap-(--fam-list-card-gap)"
        />
      )}

      <ListSurfaces m={m} />
    </div>
  );
}
