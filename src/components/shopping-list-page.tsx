import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, ShoppingCart, Trash2, Sparkles, Store, X } from "lucide-react";
import { useShopping, useShoppingStores } from "@/lib/meals-store";
import { toast } from "sonner";

const UNASSIGNED = "__unassigned__";
const ALL = "__all__";

export function ShoppingListPage() {
  const { items, addItem, toggleItem, deleteItem, clearDone } = useShopping();
  const { stores, addStore, deleteStore } = useShoppingStores();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [assignStore, setAssignStore] = useState<string>(UNASSIGNED);
  const [filterStore, setFilterStore] = useState<string>(ALL);
  const [manageOpen, setManageOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");

  const filtered = items.filter((i) => {
    if (filterStore === ALL) return true;
    if (filterStore === UNASSIGNED) return !i.store_id;
    return i.store_id === filterStore;
  });
  const pending = filtered.filter((i) => !i.done);
  const done = filtered.filter((i) => i.done);

  const storeName = (id: string | null) =>
    id ? stores.find((s) => s.id === id)?.name ?? null : null;

  const submit = async () => {
    if (!name.trim()) return;
    await addItem({
      name: name.trim(),
      quantity: qty.trim() || null,
      store_id: assignStore === UNASSIGNED ? null : assignStore,
    });
    setName("");
    setQty("");
  };

  const createStore = async () => {
    const n = newStoreName.trim();
    if (!n) return;
    await addStore(n);
    setNewStoreName("");
    toast.success(`Added ${n}`);
  };

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto">
      <header className="mb-4 sm:mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" /> Shopping list
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Anyone in the household can add. Tick to remove.
          </p>
        </div>
        <Dialog open={manageOpen} onOpenChange={setManageOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Store className="h-4 w-4" /> Stores
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage stores</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="Store name (e.g. Costco)"
                  onKeyDown={(e) => e.key === "Enter" && createStore()}
                />
                <Button onClick={createStore} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1.5">
                {stores.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No stores yet. Add one above.
                  </p>
                ) : (
                  stores.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/40"
                    >
                      <Store className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">{s.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          await deleteStore(s.id);
                          if (filterStore === s.id) setFilterStore(ALL);
                          if (assignStore === s.id) setAssignStore(UNASSIGNED);
                          toast.success(`Removed ${s.name}`);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setManageOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {stores.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">View</span>
          <Select value={filterStore} onValueChange={setFilterStore}>
            <SelectTrigger className="h-8 w-auto min-w-[160px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All stores</SelectItem>
              <SelectItem value={UNASSIGNED}>No store</SelectItem>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card className="p-3 mb-4 bg-card/80">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="flex-1"
          />
          <Input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Qty"
            className="w-20"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button onClick={submit} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {stores.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <Store className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={assignStore} onValueChange={setAssignStore}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Assign store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>No store</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </Card>

      {pending.length === 0 && done.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground bg-card/60">
          <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary/60" />
          All clear. Nothing on the list.
        </Card>
      ) : (
        <>
          <div className="space-y-1.5">
            {pending.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-card/60 hover:bg-card transition-colors"
              >
                <Checkbox checked={false} onCheckedChange={() => toggleItem(it.id, true)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{it.name}</div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {it.quantity && <span>{it.quantity}</span>}
                    {storeName(it.store_id) && (
                      <span className="inline-flex items-center gap-1">
                        <Store className="h-3 w-3" />
                        {storeName(it.store_id)}
                      </span>
                    )}
                  </div>
                </div>
                {it.source === "recipe" && (
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">recipe</span>
                )}
                {it.source === "inventory" && (
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">stock</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteItem(it.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {done.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
                  Picked up ({done.length})
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await clearDone();
                    toast.success("Cleared");
                  }}
                >
                  Clear
                </Button>
              </div>
              <div className="space-y-1.5">
                {done.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 opacity-70"
                  >
                    <Checkbox checked onCheckedChange={() => toggleItem(it.id, false)} />
                    <div className="flex-1 text-sm line-through">{it.name}</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteItem(it.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
