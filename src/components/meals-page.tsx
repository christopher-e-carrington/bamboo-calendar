import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  CalendarDays,
  ChefHat,
  Clock,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useShopping, useRecipes, useMealPlan, getWeekStart, type Recipe, type MealType } from "@/lib/meals-store";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEALS: MealType[] = ["breakfast", "lunch", "dinner"];
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};
const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: "🍳",
  lunch: "🥗",
  dinner: "🍽️",
};

export function MealsPage() {
  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <header className="mb-4 sm:mb-6">
        <h1 className="font-display text-2xl sm:text-3xl flex items-center gap-2">
          <ChefHat className="h-6 w-6 text-primary" /> Meals
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Save recipes and plan the week — calmly.
        </p>
      </header>

      <Tabs defaultValue="planner" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="planner" className="gap-1.5">
            <CalendarDays className="h-4 w-4" /> Planner
          </TabsTrigger>
          <TabsTrigger value="recipes" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Recipes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planner">
          <WeeklyPlanner />
        </TabsContent>
        <TabsContent value="recipes">
          <RecipeBook />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================== RECIPES ============================== */

function RecipeBook() {
  const { recipes, addRecipe, deleteRecipe } = useRecipes();
  const { addItems } = useShopping();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Recipe book</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New recipe
            </Button>
          </DialogTrigger>
          <RecipeDialog
            onSubmit={async (r) => {
              await addRecipe(r);
              toast.success("Recipe saved");
              setOpen(false);
            }}
          />
        </Dialog>
      </div>

      {recipes.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground bg-card/60">
          <ChefHat className="h-8 w-8 mx-auto mb-2 text-primary/60" />
          Your recipe book is empty. Add your first family favorite.
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <Card key={r.id} className="overflow-hidden bg-card/80 backdrop-blur-sm">
              {r.image_url ? (
                <div className="aspect-[16/10] bg-muted overflow-hidden">
                  <img
                    src={r.image_url}
                    alt={r.name}
                    className="w-full h-full object-cover"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                </div>
              ) : (
                <div className="aspect-[16/10] bg-gradient-to-br from-primary/10 to-accent/20 grid place-items-center">
                  <ChefHat className="h-10 w-10 text-primary/40" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium leading-snug">{r.name}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => deleteRecipe(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {r.prep_time && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" /> {r.prep_time} min
                  </div>
                )}
                {r.ingredients.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {r.ingredients.slice(0, 5).map((ing, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                        {ing}
                      </Badge>
                    ))}
                    {r.ingredients.length > 5 && (
                      <Badge variant="secondary" className="text-[10px]">
                        +{r.ingredients.length - 5}
                      </Badge>
                    )}
                  </div>
                )}
                {r.instructions && (
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-3 whitespace-pre-wrap">
                    {r.instructions}
                  </p>
                )}
                {r.ingredients.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 gap-1.5"
                    onClick={async () => {
                      await addItems(r.ingredients.map((name) => ({ name, source: "recipe" })));
                      toast.success(`Added ${r.ingredients.length} items to shopping list`);
                    }}
                  >
                    <ShoppingCart className="h-3.5 w-3.5" /> Add to shopping list
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeDialog({ onSubmit }: { onSubmit: (r: Omit<Recipe, "id" | "created_at">) => Promise<void> }) {
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [instructions, setInstructions] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New recipe</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunday miso soup" />
        </div>
        <div>
          <Label>Ingredients (one per line)</Label>
          <Textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            rows={5}
            placeholder={"2 cups water\n1 tbsp miso paste\n..."}
          />
        </div>
        <div>
          <Label>Instructions</Label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            placeholder="Step 1…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Prep time (min)</Label>
            <Input
              type="number"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              placeholder="20"
            />
          </div>
          <div>
            <Label>Image URL</Label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() => {
            if (!name.trim()) return toast.error("Name required");
            onSubmit({
              name: name.trim(),
              ingredients: ingredients
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean),
              instructions: instructions.trim() || null,
              prep_time: prepTime ? Number(prepTime) : null,
              image_url: imageUrl.trim() || null,
            });
          }}
        >
          Save recipe
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ============================== PLANNER ============================== */

function WeeklyPlanner() {
  const [weekStart] = useState(() => getWeekStart());
  const { recipes } = useRecipes();
  const { plan, assignMeal, clearSlot } = useMealPlan(weekStart);
  const { addItems } = useShopping();
  const [draggedRecipeId, setDraggedRecipeId] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ day: number; meal: MealType } | null>(null);

  const slotMap = useMemo(() => {
    const m = new Map<string, typeof plan[number]>();
    plan.forEach((p) => m.set(`${p.day_of_week}-${p.meal_type}`, p));
    return m;
  }, [plan]);

  const handleAssign = async (
    recipe: Recipe,
    day: number,
    meal: MealType,
    showOnCalendar: boolean,
  ) => {
    await assignMeal({
      recipe_id: recipe.id,
      recipe_name: recipe.name,
      day_of_week: day,
      meal_type: meal,
      show_on_calendar: showOnCalendar,
    });
    toast.success(`${recipe.name} planned for ${DAYS[day]} ${MEAL_LABEL[meal].toLowerCase()}`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      {/* Grid */}
      <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] gap-1.5 sm:gap-2">
            <div />
            {DAYS.map((d, i) => (
              <div
                key={d}
                className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground py-1"
              >
                {d}
                <div className="text-[10px] font-normal opacity-70">{dayLabel(weekStart, i)}</div>
              </div>
            ))}

            {MEALS.map((meal) => (
              <FragmentRow
                key={meal}
                meal={meal}
                slotMap={slotMap}
                onDrop={(day) => {
                  const r = recipes.find((x) => x.id === draggedRecipeId);
                  if (r) handleAssign(r, day, meal, false);
                  setDraggedRecipeId(null);
                }}
                onClick={(day) => setPicker({ day, meal })}
                onClear={(id) => clearSlot(id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Side: recipe palette */}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Drag a recipe into a slot
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {recipes.length === 0 && (
            <div className="text-sm text-muted-foreground">Save some recipes first.</div>
          )}
          {recipes.map((r) => (
            <Card
              key={r.id}
              draggable
              onDragStart={() => setDraggedRecipeId(r.id)}
              onDragEnd={() => setDraggedRecipeId(null)}
              className="p-3 cursor-grab active:cursor-grabbing bg-card/80 hover:bg-accent/40 transition-colors"
            >
              <div className="text-sm font-medium">{r.name}</div>
              {r.prep_time && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" /> {r.prep_time}m · {r.ingredients.length} ingredients
                </div>
              )}
            </Card>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3 gap-1.5"
          onClick={async () => {
            const items: { name: string; source?: string }[] = [];
            for (const slot of plan) {
              const r = recipes.find((x) => x.id === slot.recipe_id);
              if (r) r.ingredients.forEach((n) => items.push({ name: n, source: "recipe" }));
            }
            if (!items.length) return toast.info("No planned recipes yet");
            await addItems(items);
            toast.success(`Added ${items.length} items to shopping list`);
          }}
        >
          <ShoppingCart className="h-3.5 w-3.5" /> Send week to shopping list
        </Button>
      </div>

      {picker && (
        <Dialog open onOpenChange={() => setPicker(null)}>
          <RecipePicker
            day={picker.day}
            meal={picker.meal}
            recipes={recipes}
            onPick={async (recipe, show) => {
              await handleAssign(recipe, picker.day, picker.meal, show);
              setPicker(null);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

function FragmentRow({
  meal,
  slotMap,
  onDrop,
  onClick,
  onClear,
}: {
  meal: MealType;
  slotMap: Map<string, any>;
  onDrop: (day: number) => void;
  onClick: (day: number) => void;
  onClear: (id: string) => void;
}) {
  return (
    <>
      <div className="text-xs font-medium text-muted-foreground self-center pr-1 flex items-center gap-1">
        <span>{MEAL_EMOJI[meal]}</span>
        <span className="hidden sm:inline">{MEAL_LABEL[meal]}</span>
      </div>
      {Array.from({ length: 7 }).map((_, day) => {
        const slot = slotMap.get(`${day}-${meal}`);
        return (
          <div
            key={day}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(day);
            }}
            onClick={() => !slot && onClick(day)}
            className={`min-h-[60px] sm:min-h-[72px] rounded-lg border border-dashed p-1.5 text-xs transition-colors ${
              slot
                ? "bg-primary/5 border-primary/30"
                : "border-border/60 hover:border-primary/40 hover:bg-accent/30 cursor-pointer"
            }`}
          >
            {slot ? (
              <div className="flex items-start justify-between gap-1 h-full">
                <div className="leading-snug">
                  <div className="font-medium line-clamp-2">{slot.recipe_name}</div>
                  {slot.show_on_calendar && (
                    <div className="text-[9px] text-primary mt-0.5 flex items-center gap-0.5">
                      <CalendarDays className="h-2.5 w-2.5" /> on calendar
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear(slot.id);
                  }}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="opacity-40 text-center pt-2">+</div>
            )}
          </div>
        );
      })}
    </>
  );
}

function RecipePicker({
  day,
  meal,
  recipes,
  onPick,
}: {
  day: number;
  meal: MealType;
  recipes: Recipe[];
  onPick: (r: Recipe, showOnCalendar: boolean) => void;
}) {
  const [show, setShow] = useState(meal === "dinner");
  const [recipeId, setRecipeId] = useState<string>("");
  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>
          Plan {MEAL_LABEL[meal].toLowerCase()} for {DAYS[day]}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <Select value={recipeId} onValueChange={setRecipeId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a recipe" />
          </SelectTrigger>
          <SelectContent>
            {recipes.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={show} onCheckedChange={(v) => setShow(!!v)} />
          Show on Master Calendar
        </label>
      </div>
      <DialogFooter>
        <Button
          disabled={!recipeId}
          onClick={() => {
            const r = recipes.find((x) => x.id === recipeId);
            if (r) onPick(r, show);
          }}
        >
          Plan it
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function dayLabel(weekStart: string, offset: number) {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + offset);
  return d.getDate();
}
