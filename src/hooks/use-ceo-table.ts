import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useCeoTable<T extends { id: string }>(tableName: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await (supabase as any)
      .from(tableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } else {
      setData(rows || []);
    }
    setLoading(false);
  }, [tableName, toast]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const insert = async (record: Partial<T>) => {
    const { error } = await (supabase as any).from(tableName).insert(record);
    if (error) {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Criado com sucesso" });
    await fetch();
    return true;
  };

  const update = async (id: string, record: Partial<T>) => {
    const { error } = await (supabase as any).from(tableName).update(record).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Atualizado com sucesso" });
    await fetch();
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from(tableName).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Excluído com sucesso" });
    await fetch();
    return true;
  };

  return { data, loading, fetch, insert, update, remove };
}
