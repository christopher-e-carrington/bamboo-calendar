import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Boxes, Plus, ShoppingCart, Trash2, AlertCircle } from "lucide-react";
import { useInventory, useShopping } from "@/lib/meals-store";
import { toast } from "sonner";

export function InventoryPage() {
  const { items, addItem, updateItem, deleteItem } = useInventory();
  const { addItem: addShopping } = useShopping();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [category, setCategory] = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    await addItem({
      name: name.trim(),
      quantity: qty.trim() || null,
      category: category.trim() || null,
    });
    setName("");
    setQty("");
    setCategory("");
  };

  const grouped = items.reduce<Record<string, typeof items>>((acc, it) => {
    const key = it.category || "Other";
    (acc[key] ||= []).push(it);
    return acc;
  }, {});

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto">
      <header className="mb-4 sm:mb-6">
        <h1 className="font-display text-2xl sm:text-3xl flex items-center gap-2">
          <Boxes className="h-6 w-6 text-primary" /> Household inventory
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track staples you reorder regularly. Tap the cart to restock.
        </p>
      </header>

      <Card className="p-3 mb-4 bg-card/80">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px_auto] gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item" />
          <Input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
          />
          <Button onClick={submit} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground bg-card/60">
          <Boxes className="h-8 w-8 mx-auto mb-2 text-primary/60" />
          Add staples like rice, soap, paper towels…
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{cat}</h2>
              <div className="space-y-1.5">
                {list.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-card/60 hover:bg-card transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate flex items-center gap-2">
                        {it.name}
                        {it.low_stock && (
                          <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-700 dark:text-amber-400">
                            <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> low
                          </Badge>
                        )}
                      </div>
                      {it.quantity && (
                        <div className="text-[11px] text-muted-foreground">{it.quantity}</div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => updateItem(it.id, { low_stock: !it.low_stock })}
                    >
                      {it.low_stock ? "OK" : "Mark low"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary"
                      title="Add to shopping list"
                      onClick={async () => {
                        await addShopping({ name: it.name, quantity: it.quantity, source: "inventory" });
                        toast.success(`${it.name} added to shopping list`);
                      }}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                    </Button>
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
          ))}
        </div>
      )}
    </div>
  );
}
