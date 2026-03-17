import { useState, useMemo } from "react";
import { useCeoTable } from "@/hooks/use-ceo-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, CalendarIcon, Clock, MapPin, Edit2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CeoEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  location: string | null;
  initiative_id: string | null;
  project_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const emptyEvent: Partial<CeoEvent> = {
  title: "", description: "", event_date: new Date().toISOString(), end_date: null, location: "", notes: "",
};

const CeoAgenda = () => {
  const { data, loading, insert, update, remove } = useCeoTable<CeoEvent>("ceo_events");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<CeoEvent>>(emptyEvent);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);

  const openCreate = (date?: Date) => {
    setEditing({ ...emptyEvent, event_date: (date || new Date()).toISOString() });
    setDialogOpen(true);
  };
  const openEdit = (event: CeoEvent) => { setEditing({ ...event }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editing.title?.trim()) return;
    if (editing.id) {
      const { id, created_at, updated_at, ...rest } = editing as CeoEvent;
      await update(id, rest);
    } else {
      const { id, created_at, updated_at, ...rest } = editing as any;
      await insert(rest);
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) { await remove(deleteId); setDeleteId(null); }
  };

  // Day view
  const dayEvents = useMemo(() =>
    data.filter(e => isSameDay(new Date(e.event_date), currentDate))
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()),
    [data, currentDate]
  );

  // Week view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekEvents = useMemo(() =>
    data.filter(e => isWithinInterval(new Date(e.event_date), { start: weekStart, end: weekEnd })),
    [data, weekStart, weekEnd]
  );

  // Month view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) });
  const monthEvents = useMemo(() =>
    data.filter(e => isWithinInterval(new Date(e.event_date), { start: monthStart, end: monthEnd })),
    [data, monthStart, monthEnd]
  );

  const navigate = (view: string, dir: number) => {
    if (view === "dia") setCurrentDate(prev => dir > 0 ? addDays(prev, 1) : subDays(prev, 1));
    else if (view === "semana") setCurrentDate(prev => dir > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1));
    else setCurrentDate(prev => dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  const EventCard = ({ event }: { event: CeoEvent }) => (
    <div className="p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{event.title}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <Clock className="h-3 w-3" />
            {format(new Date(event.event_date), "HH:mm")}
            {event.end_date && <span>- {format(new Date(event.end_date), "HH:mm")}</span>}
          </div>
          {event.location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="h-3 w-3" /> {event.location}
            </div>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(event)}>
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(event.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground text-sm">Compromissos e planejamento.</p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="h-4 w-4 mr-2" /> Novo Evento
        </Button>
      </div>

      <Tabs defaultValue="semana">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
          </TabsList>
        </div>

        {/* Day View */}
        <TabsContent value="dia">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate("dia", -1)}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="text-lg font-semibold min-w-[200px] text-center">
              {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h2>
            <Button variant="outline" size="icon" onClick={() => navigate("dia", 1)}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          </div>
          <Card>
            <CardContent className="p-4 space-y-2">
              {dayEvents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum evento neste dia.</p>
              ) : dayEvents.map(e => <EventCard key={e.id} event={e} />)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Week View */}
        <TabsContent value="semana">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate("semana", -1)}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="text-lg font-semibold min-w-[280px] text-center">
              {format(weekStart, "dd MMM", { locale: ptBR })} — {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
            </h2>
            <Button variant="outline" size="icon" onClick={() => navigate("semana", 1)}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(day => {
              const evts = weekEvents.filter(e => isSameDay(new Date(e.event_date), day));
              const isToday = isSameDay(day, new Date());
              return (
                <Card key={day.toISOString()} className={cn("min-h-[200px]", isToday && "ring-2 ring-primary")}>
                  <CardHeader className="p-2 pb-1">
                    <p className={cn("text-xs font-medium text-center", isToday ? "text-primary" : "text-muted-foreground")}>
                      {format(day, "EEE", { locale: ptBR })}
                    </p>
                    <p className={cn("text-lg font-bold text-center", isToday && "text-primary")}>
                      {format(day, "dd")}
                    </p>
                  </CardHeader>
                  <CardContent className="p-2 pt-0 space-y-1">
                    {evts.map(e => (
                      <div key={e.id} className="text-xs p-1 rounded bg-primary/10 text-primary cursor-pointer hover:bg-primary/20" onClick={() => openEdit(e)}>
                        <span className="font-medium">{format(new Date(e.event_date), "HH:mm")}</span> {e.title}
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="w-full h-6 text-xs opacity-50 hover:opacity-100" onClick={() => openCreate(day)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Month View */}
        <TabsContent value="mes">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate("mes", -1)}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="text-lg font-semibold min-w-[200px] text-center capitalize">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <Button variant="outline" size="icon" onClick={() => navigate("mes", 1)}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          </div>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
              <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
            {monthDays.map(day => {
              const evts = data.filter(e => isSameDay(new Date(e.event_date), day));
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "bg-card min-h-[80px] p-1 cursor-pointer hover:bg-accent/50 transition-colors",
                    !isCurrentMonth && "opacity-40"
                  )}
                  onClick={() => openCreate(day)}
                >
                  <p className={cn("text-xs font-medium text-right", isToday ? "text-primary font-bold" : "text-muted-foreground")}>
                    {format(day, "d")}
                  </p>
                  {evts.slice(0, 2).map(e => (
                    <div key={e.id} className="text-[10px] p-0.5 rounded bg-primary/10 text-primary truncate mt-0.5" onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}>
                      {e.title}
                    </div>
                  ))}
                  {evts.length > 2 && <p className="text-[10px] text-muted-foreground text-center">+{evts.length - 2}</p>}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar Evento" : "Novo Evento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={editing.title || ""} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data/Hora Início *</Label>
                <Input type="datetime-local" value={editing.event_date ? format(new Date(editing.event_date), "yyyy-MM-dd'T'HH:mm") : ""} onChange={e => setEditing(p => ({ ...p, event_date: new Date(e.target.value).toISOString() }))} />
              </div>
              <div>
                <Label>Data/Hora Fim</Label>
                <Input type="datetime-local" value={editing.end_date ? format(new Date(editing.end_date), "yyyy-MM-dd'T'HH:mm") : ""} onChange={e => setEditing(p => ({ ...p, end_date: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
              </div>
            </div>
            <div>
              <Label>Local</Label>
              <Input value={editing.location || ""} onChange={e => setEditing(p => ({ ...p, location: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={editing.description || ""} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={editing.notes || ""} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!editing.title?.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CeoAgenda;
