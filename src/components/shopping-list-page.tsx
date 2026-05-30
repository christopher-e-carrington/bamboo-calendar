import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Plus, ShoppingCart, Trash2, Sparkles } from "lucide-react";
import { useShopping } from "@/lib/meals-store";
import { toast } from "sonner";

export function ShoppingListPage() {
  const { items, addItem, toggleItem, deleteItem, clearDone } = useShopping();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");

  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  const submit = async () => {
    if (!name.trim()) return;
    await addItem({ name: name.trim(), quantity: qty.trim() || null });
    setName("");
    setQty("");
  };

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto">
      <header className="mb-4 sm:mb-6">
        <h1 className="font-display text-2xl sm:text-3xl flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-primary" /> Shopping list
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Anyone in the household can add. Tick to remove.
        </p>
      </header>

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
                  {it.quantity && <div className="text-[11px] text-muted-foreground">{it.quantity}</div>}
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
