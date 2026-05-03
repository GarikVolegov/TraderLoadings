import { useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, LayoutGrid, Check, RotateCcw,
  Clock, BookOpen, Sunrise, Target, ClipboardCheck,
  CalendarDays, BarChart2, TrendingUp, BookMarked,
} from "lucide-react";

import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ClockWidget } from "@/components/ClockWidget";
import { QuoteWidget } from "@/components/QuoteWidget";
import { MissionsWidget } from "@/components/MissionsWidget";
import { CalendarWidget } from "@/components/CalendarWidget";
import { ChecklistDashboardWidget } from "@/components/ChecklistDashboardWidget";
import { SentimentWidget } from "@/components/SentimentWidget";
import { VolatilityWidget } from "@/components/VolatilityWidget";
import { CotWidget } from "@/components/CotWidget";
import { RoutineWidget } from "@/components/RoutineWidget";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Widget registry ───────────────────────────────────────────────────────────

interface WidgetDef {
  id: string;
  label: string;
  icon: React.ElementType;
  colSpan?: string;
  component: React.ComponentType;
}

const WIDGET_DEFS: WidgetDef[] = [
  { id: "clock",      label: "Orologio & Sessioni",    icon: Clock,         component: ClockWidget },
  { id: "quote",      label: "Citazione del Giorno",   icon: BookOpen,      component: QuoteWidget },
  { id: "routine",    label: "Routine Giornaliera",    icon: Sunrise,       component: RoutineWidget },
  { id: "missions",   label: "Missioni Giornaliere",   icon: Target,        component: MissionsWidget },
  { id: "checklist",  label: "Checklist Pre-Trade",    icon: ClipboardCheck,component: ChecklistDashboardWidget, colSpan: "sm:col-span-2 lg:col-span-2" },
  { id: "calendar",   label: "Calendario Economico",   icon: CalendarDays,  component: CalendarWidget, colSpan: "sm:col-span-2 lg:col-span-2" },
  { id: "sentiment",  label: "Sentiment di Mercato",   icon: BarChart2,     component: SentimentWidget },
  { id: "volatility", label: "Volatilità & ADR",       icon: TrendingUp,    component: VolatilityWidget },
  { id: "cot",        label: "COT Report",             icon: BookMarked,    component: CotWidget },
];

const DEFAULT_ORDER = WIDGET_DEFS.map((w) => w.id);
const STORAGE_KEY = "tl_dashboard_order_v1";

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const saved = JSON.parse(raw) as string[];
    // Merge: keep saved order, append any new widget IDs not yet in saved
    const valid = saved.filter((id) => DEFAULT_ORDER.includes(id));
    const missing = DEFAULT_ORDER.filter((id) => !valid.includes(id));
    return [...valid, ...missing];
  } catch {
    return DEFAULT_ORDER;
  }
}

// ─── Sortable widget wrapper ───────────────────────────────────────────────────

function SortableWidget({
  def,
  isEditing,
  isDragActive,
}: {
  def: WidgetDef;
  isEditing: boolean;
  isDragActive: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: def.id, disabled: !isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 220ms cubic-bezier(0.22,1,0.36,1)",
    zIndex: isDragging ? 20 : undefined,
  };

  const Icon = def.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? "opacity-0" : ""}`}
    >
      {/* Content */}
      <motion.div
        animate={
          isEditing
            ? { scale: isDragging ? 1.03 : 1, opacity: isDragging ? 0 : 1 }
            : { scale: 1, opacity: 1 }
        }
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={`relative transition-shadow duration-200 ${
          isEditing && !isDragging
            ? "shadow-[0_0_0_2px_hsl(var(--primary)/0.25),0_4px_20px_rgba(0,0,0,0.3)]"
            : ""
        }`}
        style={{ borderRadius: "1rem" }}
      >
        <def.component />
      </motion.div>

      {/* Edit-mode drag overlay */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            key="drag-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            {...listeners}
            {...attributes}
            className="absolute inset-0 z-10 rounded-[1rem] border-2 border-dashed border-primary/35 bg-background/60 backdrop-blur-[2px] cursor-grab active:cursor-grabbing flex items-start justify-between p-3 touch-none"
          >
            <div className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 text-primary/60" />
              <span className="text-xs font-bold text-primary/70 font-mono">{def.label}</span>
            </div>
            <GripVertical className="w-4 h-4 text-primary/50 shrink-0" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Drag ghost (overlay) ─────────────────────────────────────────────────────

function WidgetGhost({ def }: { def: WidgetDef }) {
  const Icon = def.icon;
  return (
    <div
      className="rounded-[1rem] border-2 border-primary/40 bg-card/80 backdrop-blur-md shadow-2xl shadow-black/50 p-4 flex items-center gap-3 rotate-2"
      style={{ minWidth: 200 }}
    >
      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-primary" />
      </div>
      <div>
        <p className="text-sm font-bold font-mono">{def.label}</p>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Trascina per riposizionare</p>
      </div>
      <GripVertical className="w-4 h-4 text-primary/40 ml-auto" />
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useLanguage();
  const [order, setOrder] = useState<string[]>(loadOrder);
  const [isEditing, setIsEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const prevOrderRef = useRef<string[]>(order);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const defMap = useMemo(
    () => Object.fromEntries(WIDGET_DEFS.map((d) => [d.id, d])),
    [],
  );

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      if (!over || active.id === over.id) return;
      setOrder((prev) => {
        const oldIdx = prev.indexOf(active.id as string);
        const newIdx = prev.indexOf(over.id as string);
        const next = arrayMove(prev, oldIdx, newIdx);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const handleEditToggle = () => {
    if (isEditing) {
      setIsEditing(false);
    } else {
      prevOrderRef.current = order;
      setIsEditing(true);
    }
  };

  const handleReset = () => {
    setOrder(DEFAULT_ORDER);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ORDER));
  };

  const activeWidget = activeId ? defMap[activeId] : null;

  return (
    <PageLayout>
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        action={
          <div className="flex items-center gap-2">
            {isEditing && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/40 text-xs text-muted-foreground/60 hover:text-muted-foreground/90 hover:border-border/70 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleEditToggle}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                isEditing
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "border border-border/50 text-muted-foreground/80 hover:border-primary/40 hover:text-primary hover:bg-primary/5"
              }`}
            >
              {isEditing ? (
                <>
                  <Check className="w-4 h-4" strokeWidth={3} />
                  Fatto
                </>
              ) : (
                <>
                  <LayoutGrid className="w-4 h-4" />
                  Layout
                </>
              )}
            </motion.button>
          </div>
        }
      />

      {/* Edit-mode banner */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary/20 bg-primary/5">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
              <p className="text-xs text-primary/80 font-medium">
                <strong>Modalità modifica attiva</strong> — Trascina i widget per riorganizzare la tua dashboard.
                Premi <strong>Fatto</strong> per salvare.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draggable grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {order.map((id, i) => {
              const def = defMap[id];
              if (!def) return null;
              return (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    opacity: { delay: i * 0.04, duration: 0.28 },
                    y: { delay: i * 0.04, duration: 0.28, ease: [0.22,1,0.36,1] },
                  }}
                  className={def.colSpan ?? ""}
                >
                  <SortableWidget
                    def={def}
                    isEditing={isEditing}
                    isDragActive={activeId !== null}
                  />
                </motion.div>
              );
            })}
          </div>
        </SortableContext>

        {/* Drag ghost */}
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
          {activeWidget ? <WidgetGhost def={activeWidget} /> : null}
        </DragOverlay>
      </DndContext>
    </PageLayout>
  );
}
