import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Calendar, MessageSquare, ArrowLeft, Edit2, Save, X, Phone, Archive, Sparkles, Plus, Clock, MessageCircle, Send, CheckCircle, XCircle, StickyNote, FileText, Share2, ChevronDown, RefreshCw, Download, Paperclip, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import DOMPurify from "dompurify";
import { formatDistanceToNow, differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatEmailHtml, htmlToPlainText, plainTextToHtml } from "@/lib/emailUtils";
import { buildStatusUpdateData, LeadStatus } from "@/lib/leadStatusUtils";
import WhatsAppMessageInput from "@/components/WhatsAppMessageInput";

interface Lead {
  id: string;
  name: string;
  email: string;
  emails?: string[];
  phone?: string | null;
  phones?: string[];
  message: string | null;
  source: string | null;
  origem?: string | null;
  created_at: string;
  updated_at: string;
  archived?: boolean;
  unclassified?: boolean;
  email_count?: number;
  email_inbound_count?: number;
  email_outbound_count?: number;
  whatsapp_inbound_count?: number;
  whatsapp_outbound_count?: number;
  last_interaction?: string;
  last_inbound_message?: string;
  last_interaction_direction?: 'inbound' | 'outbound';
  description?: string | null;
  description_updated_at?: string | null;
  valor?: number | null;
  moeda?: 'BRL' | 'USD' | 'EUR' | null;
  produto?: 'palestra' | 'consultoria' | 'mentoria' | 'treinamento' | 'publicidade' | null;
  publicidade_subtipo?: 'instagram' | 'youtube' | 'youtube_instagram' | null;
  status?: 'em_aberto' | 'em_negociacao' | 'ganho' | 'perdido' | 'entregue' | 'produzido' | null;
  suggested_followup?: string | null;
  valor_manually_edited?: boolean | null;
  is_recurring?: boolean | null;
  delivered_at?: string | null;
  profile_picture_url?: string | null;
  valor_pago?: number | null;
  data_proximo_pagamento?: string | null;
  proposal_url?: string | null;
  proposal_sent_at?: string | null;
  proposal_view_count?: number | null;
  proposal_last_viewed_at?: string | null;
  ai_close_probability?: number | null;
  ai_diagnosis_reason?: string | null;
  reopened_at?: string | null;
  // Timestamps de status
  ganho_at?: string | null;
  perdido_at?: string | null;
  produzido_at?: string | null;
  negociacao_at?: string | null;
}

interface EmailMessage {
  id: string;
  lead_id?: string;
  subject?: string;
  message: string | null;
  html_body?: string;
  direction: 'inbound' | 'outbound';
  timestamp: string;
  created_at: string;
  raw_data?: any;
}

interface EmailAttachment {
  id: string;
  email_message_id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  created_at: string;
}

interface WhatsAppMessage {
  id: string;
  lead_id?: string;
  phone: string;
  message: string | null;
  direction: 'inbound' | 'outbound';
  timestamp: string | null;
  created_at: string;
  is_audio?: boolean;
  raw_data?: {
    chatLid?: string;
    [key: string]: any;
  };
}

interface LeadNote {
  id: string;
  lead_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

const OpportunityDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailMessages, setEmailMessages] = useState<EmailMessage[]>([]);
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppMessage[]>([]);
  const [unlinkedWhatsappMessages, setUnlinkedWhatsappMessages] = useState<WhatsAppMessage[]>([]);
  const [linkingWhatsappMessages, setLinkingWhatsappMessages] = useState(false);
  const [leadNotes, setLeadNotes] = useState<LeadNote[]>([]);
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp'>('email');
  const [activePhoneTab, setActivePhoneTab] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const didSetInitialTab = useRef(false);
  const [loadError, setLoadError] = useState(false);
  
  // Editing states
  const [editingLead, setEditingLead] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmails, setEditEmails] = useState<string[]>([]);
  const [editPhones, setEditPhones] = useState<string[]>([]);
  const [editOrigem, setEditOrigem] = useState('');
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editingValor, setEditingValor] = useState(false);
  const [editingValorPago, setEditingValorPago] = useState(false);
  const [editingDataPagamento, setEditingDataPagamento] = useState(false);
  const [editingProbability, setEditingProbability] = useState(false);
  const [tempValor, setTempValor] = useState<string>('');
  const [tempValorPago, setTempValorPago] = useState<string>('');
  const [tempDataPagamento, setTempDataPagamento] = useState<string>('');
  const [tempProbability, setTempProbability] = useState<string>('');
  const [tempMoeda, setTempMoeda] = useState<'BRL' | 'USD' | 'EUR'>('BRL');
  
  // Other states
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showProposalEmailDialog, setShowProposalEmailDialog] = useState(false);
  const [proposalEmailSubject, setProposalEmailSubject] = useState('');
  const [proposalEmailBody, setProposalEmailBody] = useState('');
  const [generatingProposalEmail, setGeneratingProposalEmail] = useState(false);
  const [sendingProposalEmail, setSendingProposalEmail] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailAttachmentFiles, setEmailAttachmentFiles] = useState<File[]>([]);
  const emailFileInputRef = useRef<HTMLInputElement>(null);
  const [previousOpportunities, setPreviousOpportunities] = useState<Array<{id: string, delivered_at: string, valor: number | null, moeda: string, produto: string | null}>>([]);
  
  // WhatsApp import states
  const [showWhatsAppImportDialog, setShowWhatsAppImportDialog] = useState(false);
  const [whatsappImportText, setWhatsappImportText] = useState('');
  const [importingWhatsApp, setImportingWhatsApp] = useState(false);
   const [syncingWhatsAppLid, setSyncingWhatsAppLid] = useState(false);
   const [exportingLead, setExportingLead] = useState(false);
   
   // Email import states
   const [showEmailImportDialog, setShowEmailImportDialog] = useState(false);
   const [emailImportText, setEmailImportText] = useState('');
   const [importingEmail, setImportingEmail] = useState(false);
  
  const normalizePhoneNumber = (p: string) => {
    const digits = (p || '').toString().replace(/\D/g, '');
    return digits.startsWith('55') ? digits.slice(2) : digits;
  };

  const uniqueNormalizedPhones = (phones?: string[]) => {
    if (!phones) return [] as string[];
    const set = new Set(phones.map(normalizePhoneNumber));
    return Array.from(set);
  };

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadingMessages(true);
    setLoadError(false);

    const timeoutId = setTimeout(() => {
      setLoadError(true);
      setLoading(false);
      setLoadingMessages(false);
    }, 30000);

    try {
      const results = await Promise.allSettled([
        fetchLead(),
        fetchMessagesById(id),
        fetchNotesById(id),
      ]);
      const hasRejected = results.some(r => r.status === 'rejected');
      if (hasRejected) {
        console.error('Algumas queries falharam:', results.filter(r => r.status === 'rejected'));
        setLoadError(true);
      }
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
      setLoadError(true);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setLoadingMessages(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // fetchPreviousOpportunities depends on lead.emails, runs after lead loads
  useEffect(() => {
    if (lead?.id) {
      fetchPreviousOpportunities();
    }
  }, [lead?.id]);

  // WhatsApp phone fallback: runs after lead loads, only if few messages
  useEffect(() => {
    if (lead?.id && lead?.phones) {
      fetchWhatsappPhoneFallback(lead.id, lead.phones);
    }
  }, [lead?.id]);

  // Default to WhatsApp when there is WhatsApp activity (helps avoid "sumiu" confusion)
  useEffect(() => {
    if (!lead?.id || didSetInitialTab.current) return;
    const wCount = (lead.whatsapp_inbound_count || 0) + (lead.whatsapp_outbound_count || 0);
    if (wCount > 0) {
      setActiveTab('whatsapp');
    }
    didSetInitialTab.current = true;
  }, [lead?.id]);

  const fetchLead = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Use cached counters from leads table (no extra queries needed)
      const lastInbound = data.last_inbound_message_at;
      const lastOutbound = data.last_outbound_message_at;
      let lastInteraction: string | null = null;
      let lastInteractionDirection: 'inbound' | 'outbound' | null = null;

      if (lastInbound && lastOutbound) {
        if (new Date(lastInbound) >= new Date(lastOutbound)) {
          lastInteraction = lastInbound;
          lastInteractionDirection = 'inbound';
        } else {
          lastInteraction = lastOutbound;
          lastInteractionDirection = 'outbound';
        }
      } else if (lastInbound) {
        lastInteraction = lastInbound;
        lastInteractionDirection = 'inbound';
      } else if (lastOutbound) {
        lastInteraction = lastOutbound;
        lastInteractionDirection = 'outbound';
      }

      setLead({
        ...data,
        moeda: data.moeda as 'BRL' | 'USD' | 'EUR' | null,
        produto: data.produto as 'palestra' | 'consultoria' | 'mentoria' | 'treinamento' | 'publicidade' | null,
        publicidade_subtipo: data.publicidade_subtipo as 'instagram' | 'youtube' | 'youtube_instagram' | null,
        status: data.status as 'em_negociacao' | 'ganho' | 'perdido' | 'entregue' | null,
        email_inbound_count: data.email_inbound_count || 0,
        email_outbound_count: data.email_outbound_count || 0,
        whatsapp_inbound_count: data.whatsapp_inbound_count || 0,
        whatsapp_outbound_count: data.whatsapp_outbound_count || 0,
        last_interaction: lastInteraction,
        last_interaction_direction: lastInteractionDirection
      });
    } catch (error) {
      console.error('Erro ao carregar lead:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a oportunidade.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Fetch messages by lead_id directly (no dependency on lead state)
  const fetchMessagesById = async (leadId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const [emailData, whatsappData, attachmentsData] = await Promise.all([
        supabase
          .from('email_messages')
          .select('id, lead_id, subject, message, html_body, direction, timestamp, created_at')
          .eq('lead_id', leadId)
          .order('timestamp', { ascending: false }),
        supabase
          .from('whatsapp_messages')
          .select('id, lead_id, phone, message, direction, timestamp, created_at, is_audio')
          .eq('lead_id', leadId)
          .order('timestamp', { ascending: true }),
        supabase
          .from('email_attachments')
          .select('id, email_message_id, filename, content_type, size_bytes, storage_path, created_at')
          .eq('lead_id', leadId)
          .is('deleted_at', null)
      ]);

      if (emailData.data) setEmailMessages(emailData.data as EmailMessage[]);
      setWhatsappMessages((whatsappData.data || []) as WhatsAppMessage[]);
      if (attachmentsData.data) setEmailAttachments(attachmentsData.data);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      throw error;
    }
  };

  // Phone fallback for WhatsApp (runs after lead loads, non-blocking)
  const fetchWhatsappPhoneFallback = async (leadId: string, phones?: string[]) => {
    const leadPhones = uniqueNormalizedPhones(phones);
    if (leadPhones.length === 0) return;

    // Only run if we have few messages already
    if (whatsappMessages.length >= 2) return;

    const orParts: string[] = [];
    for (const local of leadPhones) {
      const with55 = `55${local}`;
      orParts.push(`phone.eq.${with55}`);
      orParts.push(`phone.eq.${local}`);
      orParts.push(`phone.ilike.*${local}*`);
    }

    try {
      const { data: byPhone } = await supabase
        .from('whatsapp_messages')
        .select('id, lead_id, phone, message, direction, timestamp, created_at, is_audio')
        .or(orParts.join(','))
        .order('timestamp', { ascending: true });

      const phoneMatches = (byPhone || []) as WhatsAppMessage[];
      if (phoneMatches.length === 0) return;

      setWhatsappMessages(prev => {
        const byId = new Map<string, WhatsAppMessage>();
        for (const m of [...prev, ...phoneMatches]) {
          byId.set(m.id, m);
        }
        return Array.from(byId.values()).sort((a, b) => {
          const tA = Date.parse((a.timestamp || a.created_at) as string);
          const tB = Date.parse((b.timestamp || b.created_at) as string);
          return tA - tB;
        });
      });

      const detectedUnlinked = phoneMatches.filter((m) => (m.lead_id || null) !== leadId);
      setUnlinkedWhatsappMessages(detectedUnlinked);
    } catch (error) {
      console.error('Erro no fallback WhatsApp por telefone:', error);
    }
  };

  // Legacy wrapper for components that call fetchMessages() after send
  const fetchMessages = async (silent = false) => {
    if (!id) return;
    try {
      await fetchMessagesById(id, silent);
    } catch {
      // Errors already logged inside fetchMessagesById
    } finally {
      setLoadingMessages(false);
    }
    if (lead?.phones) {
      await fetchWhatsappPhoneFallback(id, lead.phones);
    }
  };

  const handleLinkWhatsappMessages = async () => {
    if (!lead?.id) return;
    if (unlinkedWhatsappMessages.length === 0) return;
    try {
      setLinkingWhatsappMessages(true);
      const ids = unlinkedWhatsappMessages.map((m) => m.id);
      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ lead_id: lead.id })
        .in('id', ids);
      if (error) throw error;
      await fetchMessages();
      toast({
        title: 'Mensagens vinculadas',
        description: 'As mensagens foram vinculadas a esta oportunidade.',
      });
    } catch (error) {
      console.error('Erro ao vincular mensagens:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível vincular as mensagens.',
        variant: 'destructive',
      });
    } finally {
      setLinkingWhatsappMessages(false);
    }
  };

  const handleSyncWhatsAppLid = async () => {
    if (!lead?.id) return;
    
    try {
      setSyncingWhatsAppLid(true);
      
      const { data, error } = await supabase.functions.invoke('get-whatsapp-lid', {
        body: { leadId: lead.id }
      });

      if (error) throw error;

      if (data.success) {
        const parts: string[] = [];
        if (data.chatLidsAdded?.length > 0) {
          parts.push(`${data.chatLidsAdded.length} chatLid(s) sincronizado(s)`);
        }
        if (data.messagesReconciled > 0) {
          parts.push(`${data.messagesReconciled} mensagem(ns) vinculada(s)`);
        }
        
        if (parts.length > 0) {
          toast({
            title: 'WhatsApp sincronizado',
            description: parts.join(' • '),
          });
          // Reload messages
          await fetchMessages();
          await fetchLead();
        } else {
          toast({
            title: 'Sincronização concluída',
            description: 'Nenhuma atualização necessária.',
          });
        }
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao sincronizar WhatsApp:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível sincronizar o WhatsApp.',
        variant: 'destructive',
      });
    } finally {
      setSyncingWhatsAppLid(false);
    }
  };

  const fetchNotesById = async (leadId: string) => {
    try {
      const { data, error } = await supabase
        .from('lead_notes')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeadNotes(data || []);
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
      throw error;
    }
  };

  // Legacy wrapper
  const fetchNotes = async () => {
    if (!id) return;
    try {
      await fetchNotesById(id);
    } catch {
      // Errors already logged inside fetchNotesById
    }
  };

  const fetchPreviousOpportunities = async () => {
    if (!lead || !lead.emails || lead.emails.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, delivered_at, valor, moeda, produto')
        .neq('id', lead.id)
        .eq('status', 'entregue')
        .not('delivered_at', 'is', null)
        .or(lead.emails.map(e => `emails.cs.{${e}}`).join(','))
        .order('delivered_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setPreviousOpportunities(data || []);
    } catch (error) {
      console.error('Erro ao carregar oportunidades anteriores:', error);
    }
  };

  const startEdit = () => {
    if (!lead) return;
    setEditName(lead.name);
    setEditEmails(lead.emails || [lead.email].filter(Boolean));
    setEditPhones(lead.phones || [lead.phone].filter(Boolean) as string[]);
    setEditOrigem(lead.origem || '');
    setEditIsRecurring(lead.is_recurring || false);
    setEditingLead(true);
  };

  const cancelEdit = () => {
    setEditingLead(false);
    setEditName('');
    setEditEmails([]);
    setEditPhones([]);
    setEditOrigem('');
    setEditIsRecurring(false);
  };

  const saveEdit = async () => {
    if (!lead) return;
    
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          name: editName,
          emails: editEmails.filter(e => e.trim()),
          phones: editPhones.filter(p => p.trim()),
          email: editEmails[0] || lead.email,
          phone: editPhones[0] || lead.phone,
          origem: editOrigem.trim() || null,
          is_recurring: editIsRecurring,
        })
        .eq('id', lead.id);

      if (error) throw error;

      setLead({
        ...lead,
        name: editName,
        emails: editEmails.filter(e => e.trim()),
        phones: editPhones.filter(p => p.trim()),
        email: editEmails[0] || lead.email,
        phone: editPhones[0] || lead.phone,
        origem: editOrigem.trim() || null,
        is_recurring: editIsRecurring,
      });

      setEditingLead(false);
      toast({
        title: 'Salvo',
        description: 'Alterações salvas com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      });
    }
  };

  const addEmail = () => setEditEmails([...editEmails, '']);
  const removeEmail = (index: number) => setEditEmails(editEmails.filter((_, i) => i !== index));
  const addPhone = () => setEditPhones([...editPhones, '']);
  const removePhone = (index: number) => setEditPhones(editPhones.filter((_, i) => i !== index));

  const handleArchiveLead = async () => {
    if (!lead) return;
    
    try {
      const { error } = await supabase
        .from('leads')
        .update({ archived: true })
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: 'Arquivado',
        description: 'Lead arquivado com sucesso.',
      });
      navigate('/');
    } catch (error) {
      console.error('Erro ao arquivar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível arquivar.',
        variant: 'destructive',
      });
    }
  };

  const handleExportLead = async () => {
    if (!lead) return;
    
    try {
      setExportingLead(true);
      
      // Build context for AI
      const allEmails = lead.emails?.filter(e => !e.endsWith('@whatsapp.temp')) || [];
      const notesText = leadNotes.map(n => n.note).join('\n');
      const emailsText = emailMessages.map(e => {
        const dir = e.direction === 'inbound' ? 'Cliente' : 'Nós';
        return `[${e.direction}] ${e.subject || ''}: ${e.message?.substring(0, 300) || ''}`;
      }).join('\n');
      const whatsappText = whatsappMessages.slice(-20).map(m => {
        const dir = m.direction === 'inbound' ? 'Cliente' : 'Nós';
        return `${dir}: ${m.message || ''}`;
      }).join('\n');
      
      const context = `Lead: ${lead.name}
Emails: ${allEmails.join(', ')}
Telefones: ${lead.phones?.join(', ') || 'N/A'}
Produto: ${lead.produto || 'Não definido'}
Moeda: ${lead.moeda || 'BRL'}
Valor: ${lead.valor || 'N/A'}
Valor pago: ${lead.valor_pago || 0}
Status: ${lead.status}
Descrição: ${lead.description || 'N/A'}
delivery_date: ${lead.delivered_at || 'N/A'}
expected_payment_date: ${lead.data_proximo_pagamento || 'N/A'}
Origem: ${lead.origem || 'N/A'}

Notas:
${notesText || 'Nenhuma'}

Últimos emails:
${emailsText || 'Nenhum'}

Últimas mensagens WhatsApp:
${whatsappText || 'Nenhuma'}`;

      const { data, error } = await supabase.functions.invoke('generate-lead-export', {
        body: { context, leadName: lead.name }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao exportar');
      }
      
      toast({
        title: 'Exportado',
        description: 'Cliente enviado para o sistema de cobrança com sucesso.',
      });
    } catch (error: any) {
      console.error('Erro ao exportar:', error);
      const msg = error?.message || '';
      const isEmailError = msg.toLowerCase().includes('email');
      toast({
        title: 'Erro ao exportar',
        description: isEmailError
          ? 'Não é possível exportar o cliente sem um e-mail cadastrado.'
          : 'Não foi possível exportar as informações.',
        variant: 'destructive',
      });
    } finally {
      setExportingLead(false);
    }
  };

  const generateDescription = async () => {
    if (!lead) return;
    setGeneratingDescription(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-lead-description', {
        body: { leadId: lead.id }
      });

      if (error) throw error;

      setLead({ ...lead, description: data.description });
      toast({
        title: 'Descrição gerada',
        description: 'A descrição foi atualizada com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao gerar descrição:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar a descrição.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleSaveValor = async () => {
    if (!lead) return;
    
    try {
      const valorNum = tempValor ? parseFloat(tempValor) : null;
      
      const { error } = await supabase
        .from('leads')
        .update({ 
          valor: valorNum, 
          moeda: tempMoeda,
          valor_manually_edited: true 
        })
        .eq('id', lead.id);

      if (error) throw error;

      setLead({ ...lead, valor: valorNum, moeda: tempMoeda, valor_manually_edited: true });
      setEditingValor(false);
      toast({
        title: 'Valor atualizado',
        description: 'O valor foi atualizado com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao salvar valor:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o valor.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveValorPago = async () => {
    if (!lead) return;
    
    try {
      const valorPagoNum = tempValorPago ? parseFloat(tempValorPago) : 0;
      
      const { error } = await supabase
        .from('leads')
        .update({ valor_pago: valorPagoNum })
        .eq('id', lead.id);

      if (error) throw error;

      setLead({ ...lead, valor_pago: valorPagoNum });
      setEditingValorPago(false);
      toast({
        title: 'Valor pago atualizado',
        description: 'O valor pago foi atualizado com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao salvar valor pago:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o valor pago.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveDataPagamento = async () => {
    if (!lead) return;
    
    try {
      const dataValue = tempDataPagamento || null;
      
      const { error } = await supabase
        .from('leads')
        .update({ data_proximo_pagamento: dataValue })
        .eq('id', lead.id);

      if (error) throw error;

      setLead({ ...lead, data_proximo_pagamento: dataValue });
      setEditingDataPagamento(false);
      toast({
        title: 'Data atualizada',
        description: 'A data do próximo pagamento foi atualizada.',
      });
    } catch (error) {
      console.error('Erro ao salvar data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a data.',
        variant: 'destructive',
      });
    }
  };

  const handleAddNote = async () => {
    if (!lead || !newNoteText.trim()) return;
    setAddingNote(true);
    
    try {
      const { data, error } = await supabase
        .from('lead_notes')
        .insert({
          lead_id: lead.id,
          note: newNoteText.trim()
        })
        .select()
        .single();

      if (error) throw error;

      setLeadNotes([data, ...leadNotes]);
      setNewNoteText('');
      setShowAddNoteDialog(false);
      toast({
        title: 'Nota adicionada',
        description: 'A nota foi adicionada com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao adicionar nota:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar a nota.',
        variant: 'destructive',
      });
    } finally {
      setAddingNote(false);
    }
  };

  const handleSendProposalEmail = async () => {
    if (!lead) return;
    setSendingProposalEmail(true);
    
    try {
      const recipients = lead.emails && lead.emails.length > 0 ? lead.emails : [lead.email];
      
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: recipients,
          subject: proposalEmailSubject,
          body: proposalEmailBody,
          leadId: lead.id
        }
      });

      if (error) throw error;

      // Update proposal_sent_at
      await supabase
        .from('leads')
        .update({ proposal_sent_at: new Date().toISOString() })
        .eq('id', lead.id);

      setLead({ ...lead, proposal_sent_at: new Date().toISOString() });
      setShowProposalEmailDialog(false);
      toast({
        title: 'Email enviado',
        description: `Email enviado para ${recipients.join(', ')}`,
      });
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar o email.',
        variant: 'destructive',
      });
    } finally {
      setSendingProposalEmail(false);
    }
  };

  const handleSendDirectWhatsApp = useCallback(async (message: string) => {
    if (!lead || !activePhoneTab) return;
    
    try {
      // Encontrar o telefone original completo (com código de país) que corresponde ao tab normalizado
      const originalPhone = lead.phones?.find(p => normalizePhoneNumber(p) === activePhoneTab) || activePhoneTab;

      // Optimistically add the message to local state
      const optimisticMsg: WhatsAppMessage = {
        id: `temp-${Date.now()}`,
        lead_id: lead.id,
        phone: originalPhone,
        message,
        direction: 'outbound',
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setWhatsappMessages(prev => [...prev, optimisticMsg]);

      const { error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          phone: originalPhone,
          message,
          leadId: lead.id
        }
      });

      if (error) throw error;

      toast({
        title: 'Mensagem enviada',
        description: 'Mensagem WhatsApp enviada com sucesso.',
      });
      // Silent refetch to sync real data without showing loading
      fetchMessages(true);
    } catch (err) {
      console.error('Erro ao enviar WhatsApp:', err);
      toast({
        title: 'Erro ao enviar mensagem',
        description: err instanceof Error ? err.message : 'Não foi possível enviar a mensagem WhatsApp.',
        variant: 'destructive',
      });
    }
  }, [lead, activePhoneTab, toast, fetchMessages]);

  const handleGenerateEmail = async () => {
    if (!lead) return;
    setGeneratingEmail(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-email-reply', {
        body: {
          emails: emailMessages,
          leadName: lead.name,
          leadDescription: lead.description
        }
      });

      if (error) throw error;

      setEmailSubject(data.subject || '');
      // Convert HTML body to plain text for the textarea
      const plainBody = htmlToPlainText(data.body || '');
      setEmailBody(plainBody);
      setEmailAttachmentFiles([]);
      setShowEmailComposer(true);
      toast({
        title: 'Email gerado',
        description: 'Revise e edite o email antes de enviar.',
      });
    } catch (error: any) {
      console.error('Erro ao gerar email:', error);
      toast({
        title: 'Erro ao gerar email',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingEmail(false);
    }
  };

  const handleSendEmail = async () => {
    if (!lead || !emailSubject.trim() || !emailBody.trim()) return;
    setSendingEmail(true);
    
    try {
      const recipients = lead.emails && lead.emails.length > 0 ? lead.emails : [lead.email];

      // If there are attachments, encode them as base64
      let attachments: { filename: string; content: string; type: string }[] = [];
      if (emailAttachmentFiles.length > 0) {
        attachments = await Promise.all(
          emailAttachmentFiles.map(async (file) => {
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            bytes.forEach((b) => { binary += String.fromCharCode(b); });
            const base64 = btoa(binary);
            return { filename: file.name, content: base64, type: file.type };
          })
        );
      }
      
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: recipients,
          subject: emailSubject,
          body: plainTextToHtml(emailBody),
          leadId: lead.id,
          attachments: attachments.length > 0 ? attachments : undefined,
        }
      });

      if (error) throw error;

      setShowEmailComposer(false);
      setEmailSubject('');
      setEmailBody('');
      setEmailAttachmentFiles([]);
      toast({
        title: 'Email enviado',
        description: `Email enviado para ${recipients.join(', ')}`,
      });
      fetchMessages(true);
    } catch (error: any) {
      console.error('Erro ao enviar email:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível enviar o email.',
        variant: 'destructive',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const importWhatsAppMessages = async () => {
    if (!whatsappImportText.trim() || !lead?.id) {
      toast({
        title: 'Erro',
        description: 'Cole as mensagens do WhatsApp para importar',
        variant: 'destructive',
      });
      return;
    }

    setImportingWhatsApp(true);
    try {
      const phone = lead.phones?.[0] || lead.phone;
      
      if (!phone) {
        throw new Error('Lead não possui número de telefone');
      }

      console.log('Iniciando importação de mensagens...');
      
      const { data, error } = await supabase.functions.invoke('import-whatsapp-messages', {
        body: {
          text: whatsappImportText,
          leadId: lead.id,
          phone: phone
        }
      });

      console.log('Resposta da função:', { data, error });

      if (error) {
        throw error;
      }

      toast({
        title: 'Importação iniciada',
        description: 'As mensagens estão sendo processadas e aparecerão em breve.',
      });

      setShowWhatsAppImportDialog(false);
      setWhatsappImportText('');
      
      // Refresh messages after a delay
      setTimeout(() => fetchMessages(), 3000);
    } catch (error: any) {
      console.error('Erro ao importar mensagens:', error);
      toast({
        title: 'Erro ao importar',
        description: error.message || 'Não foi possível importar as mensagens',
        variant: 'destructive',
      });
    } finally {
      setImportingWhatsApp(false);
    }
  };

   const importEmailMessages = async () => {
     if (!emailImportText.trim() || !lead?.id) {
       toast({
         title: 'Erro',
         description: 'Cole os emails para importar',
         variant: 'destructive',
       });
       return;
     }
 
     setImportingEmail(true);
     try {
       console.log('Iniciando importação de emails...');
       
       const { data, error } = await supabase.functions.invoke('import-email-messages', {
         body: {
           text: emailImportText,
           leadId: lead.id
         }
       });
 
       console.log('Resposta da função:', { data, error });
 
       if (error) {
         throw error;
       }
 
       toast({
         title: 'Importação iniciada',
         description: 'Os emails estão sendo processados e aparecerão em breve.',
       });
 
       setShowEmailImportDialog(false);
       setEmailImportText('');
       
       // Refresh messages after a delay
       setTimeout(() => fetchMessages(), 3000);
     } catch (error: any) {
       console.error('Erro ao importar emails:', error);
       toast({
         title: 'Erro ao importar',
         description: error.message || 'Não foi possível importar os emails',
         variant: 'destructive',
       });
     } finally {
       setImportingEmail(false);
     }
   };
 
  const scrollWhatsappToBottom = useCallback(() => {
    // Use requestAnimationFrame + setTimeout to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const activePanel = document.querySelector('[role="tabpanel"][data-state="active"] [data-whatsapp-scroll]') as HTMLElement | null
            || document.querySelector('[data-whatsapp-scroll]') as HTMLElement | null;
          const viewport = activePanel?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
          if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
          }
        } catch (e) {
          console.error('scrollWhatsappToBottom error:', e);
        }
      }, 100);
    });
  }, []);

  // Helper to get conversation key from a message (used for grouping display)
  const getConversationKey = useCallback((msg: WhatsAppMessage): string => {
    // Normalize the phone, stripping @lid suffix if present
    const phone = msg.phone || '';
    const cleaned = phone.replace(/@.*$/, '').replace(/\D/g, '');
    return cleaned.startsWith('55') ? cleaned.slice(2) : cleaned;
  }, []);

  // For this lead, all messages with lead_id should be shown together
  // No need to separate by phone/chatLid - they're all the same conversation
  const messagesForDisplay = useMemo(() => {
    // Simply return all whatsapp messages - they're already filtered by lead_id
    return whatsappMessages;
  }, [whatsappMessages]);

  // Initialize activePhoneTab when lead loads
  useEffect(() => {
    if (lead?.phones && lead.phones.length > 0 && !activePhoneTab) {
      setActivePhoneTab(normalizePhoneNumber(lead.phones[0]));
    }
  }, [lead?.phones, activePhoneTab]);

  // Scroll when messages change or tab changes
  useEffect(() => {
    scrollWhatsappToBottom();
  }, [whatsappMessages, activePhoneTab, scrollWhatsappToBottom]);

  // Also scroll when switching to WhatsApp tab
  useEffect(() => {
    if (activeTab === 'whatsapp') {
      scrollWhatsappToBottom();
    }
  }, [activeTab, scrollWhatsappToBottom]);

  // Realtime subscription for WhatsApp messages
  useEffect(() => {
    if (!lead?.id) return;
    
    const channel = supabase
      .channel(`whatsapp-messages-${lead.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `lead_id=eq.${lead.id}`
        },
        (payload) => {
          console.log('Nova mensagem WhatsApp recebida via realtime:', payload);
          setWhatsappMessages(prev => [...prev, payload.new as WhatsAppMessage]);
          // Scroll to bottom when new message arrives
          setTimeout(() => scrollWhatsappToBottom(), 150);
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [lead?.id, scrollWhatsappToBottom]);

  if (loadError && !lead) {
    // Show error screen when load failed and no lead data is available
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-6xl mx-auto text-center py-20">
          <p className="text-muted-foreground mb-4">O carregamento demorou demais ou falhou.</p>
          <Button onClick={loadAll} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <Card className="mb-4">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-60" />
                </div>
              </div>
              <div className="flex gap-4 flex-wrap">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-10 w-64 mb-4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-4xl font-bold mb-8">Oportunidade não encontrada</h1>
          <Button onClick={() => navigate('/')}>Voltar para lista</Button>
        </div>
      </div>
    );
  }

  const groupedPhones = uniqueNormalizedPhones(lead.phones);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 overflow-x-hidden">
      <div className="max-w-6xl mx-auto overflow-x-hidden">
        
        <div className="mb-8">
          {editingLead ? (
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nome</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nome do lead"
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">E-mails</label>
                    <Button onClick={addEmail} size="sm" variant="outline" type="button">
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editEmails.map((email, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={email}
                          onChange={(e) => {
                            const newEmails = [...editEmails];
                            newEmails[index] = e.target.value;
                            setEditEmails(newEmails);
                          }}
                          placeholder="email@exemplo.com"
                        />
                        <Button onClick={() => removeEmail(index)} size="sm" variant="destructive" type="button">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {editEmails.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum e-mail cadastrado</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Telefones</label>
                    <Button onClick={addPhone} size="sm" variant="outline" type="button">
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editPhones.map((phone, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={phone}
                          onChange={(e) => {
                            const newPhones = [...editPhones];
                            newPhones[index] = e.target.value;
                            setEditPhones(newPhones);
                          }}
                          placeholder="5511999999999"
                        />
                        <Button onClick={() => removePhone(index)} size="sm" variant="destructive" type="button">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {editPhones.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum telefone cadastrado</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Origem</label>
                  <select
                    value={editOrigem}
                    onChange={(e) => setEditOrigem(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Não definido</option>
                    <option value="instagram">Instagram</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="email">E-mail</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="indicacao">Indicação</option>
                    <option value="site">Site</option>
                    <option value="evento">Evento</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="edit_is_recurring"
                    checked={editIsRecurring}
                    onCheckedChange={(checked) => setEditIsRecurring(checked === true)}
                  />
                  <label htmlFor="edit_is_recurring" className="text-sm font-medium cursor-pointer">
                    Cliente Recorrente
                  </label>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={saveEdit} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                  <Button onClick={cancelEdit} variant="outline" size="sm">
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <>
              {/* Header Compacto com Atividade */}
              <Card className="mb-4">
                <CardContent className="p-4">
                  {/* Linha do nome + botões de ação no canto superior direito */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Mail className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                      <h1 className="text-xl md:text-2xl font-bold truncate">{lead.name || 'Lead sem nome'}</h1>
                      {lead.reopened_at && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-300 text-xs whitespace-nowrap flex-shrink-0">
                          🔄 Reaberto
                        </Badge>
                      )}
                    </div>
                    
                    {/* Botões de ação - canto superior direito */}
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 flex-wrap justify-end">
                      <Button onClick={startEdit} variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        onClick={generateDescription} 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={generatingDescription}
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                      <Button 
                        onClick={handleArchiveLead} 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button 
                        onClick={() => setShowAddNoteDialog(true)} 
                        size="sm"
                        className="bg-gray-900 text-white hover:bg-gray-800 h-8 px-3"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Nota
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        className="h-8 px-3"
                        onClick={() => {
                          const url = `${window.location.origin}/opportunity/${lead.id}`;
                          navigator.clipboard.writeText(url);
                          toast({
                            title: 'Link copiado',
                            description: 'O link foi copiado para a área de transferência.',
                          });
                        }}
                      >
                        <Share2 className="h-4 w-4 mr-1" />
                        Compartilhar
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        className="h-8 px-3"
                        onClick={() => window.open(`/proposal?leadId=${lead.id}`, '_blank')}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Proposta
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        className="h-8 px-3"
                        onClick={handleExportLead}
                        disabled={exportingLead}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        {exportingLead ? 'Exportando...' : 'Exportar'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Emails, Telefones e Atividade na mesma linha */}
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Informações de contato - lado esquerdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row md:gap-8 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Emails:</span>
                          {lead.emails && lead.emails.length > 0 ? (
                            lead.emails.map((email, i) => (
                              <div key={i} className="text-foreground break-all">{email}</div>
                            ))
                          ) : (
                            <div className="text-foreground break-all">{lead.email || 'Não informado'}</div>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Telefones:</span>
                          {lead.phones && lead.phones.length > 0 ? (
                            lead.phones.map((phone, i) => (
                              <div key={i} className="text-foreground">{phone}</div>
                            ))
                          ) : (
                            <div className="text-foreground">Não informado</div>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Origem:</span>
                          <div className="text-foreground">
                            {lead.origem === 'instagram' && 'Instagram'}
                            {lead.origem === 'linkedin' && 'LinkedIn'}
                            {lead.origem === 'email' && 'E-mail'}
                            {lead.origem === 'whatsapp' && 'WhatsApp'}
                            {lead.origem === 'indicacao' && 'Indicação'}
                            {lead.origem === 'site' && 'Site'}
                            {lead.origem === 'evento' && 'Evento'}
                            {lead.origem === 'outro' && 'Outro'}
                            {!lead.origem && 'Não definida'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Descrição e Atividade lado a lado */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                {/* Descrição */}
                {lead.description && (
                  <Card className="lg:col-span-2">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-foreground">Descrição</h3>
                        <Button 
                          onClick={generateDescription} 
                          variant="ghost" 
                          size="sm"
                          className="p-1"
                          disabled={generatingDescription}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.description}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Atividade Card */}
                <Card className={lead.description ? "" : "lg:col-span-3"}>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Atividade</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm">WhatsApp</span>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <span className="text-muted-foreground whitespace-nowrap">Enviadas: <span className="font-semibold text-foreground">{lead.whatsapp_outbound_count || 0}</span></span>
                          <span className="text-muted-foreground whitespace-nowrap">Recebidas: <span className="font-semibold text-foreground">{lead.whatsapp_inbound_count || 0}</span></span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-blue-600" />
                          <span className="text-sm">Email</span>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <span className="text-muted-foreground whitespace-nowrap">Enviados: <span className="font-semibold text-foreground">{lead.email_outbound_count || 0}</span></span>
                          <span className="text-muted-foreground whitespace-nowrap">Recebidos: <span className="font-semibold text-foreground">{lead.email_inbound_count || 0}</span></span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs pt-2 border-t mt-2">
                        <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground whitespace-nowrap">Última interação:</span>
                        {lead.last_interaction ? (
                          <>
                            <span className="font-medium whitespace-nowrap">
                              há {formatDistanceToNow(new Date(lead.last_interaction), { 
                                addSuffix: false, 
                                locale: ptBR 
                              })}
                            </span>
                            {lead.last_interaction_direction && (
                              <Badge 
                                variant={lead.last_interaction_direction === 'inbound' ? 'default' : 'secondary'}
                                className="text-xs h-5"
                              >
                                {lead.last_interaction_direction === 'inbound' ? 'Cliente' : 'Você'}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="font-medium">Sem interações</span>
                        )}
                      </div>

                      {/* Próximo follow-up automático para leads de publicidade */}
                      {lead.produto === 'publicidade' && lead.status === 'em_aberto' && (() => {
                        // Use last_outbound from email messages or lead field
                        const lastOutboundAt = lead.last_interaction_direction === 'outbound' 
                          ? lead.last_interaction 
                          : null;
                        // Find last outbound email from emailMessages
                        const lastOutboundEmail = [...emailMessages].reverse().find(e => e.direction === 'outbound');
                        const lastInboundEmail = [...emailMessages].reverse().find(e => e.direction === 'inbound');
                        
                        const outboundTs = lastOutboundEmail?.timestamp;
                        if (!outboundTs) return null;
                        
                        const lastOutbound = new Date(outboundTs);
                        const lastInbound = lastInboundEmail ? new Date(lastInboundEmail.timestamp) : null;
                        const hasUnansweredOutbound = !lastInbound || lastInbound < lastOutbound;
                        
                        if (!hasUnansweredOutbound) return null;
                        
                        // Count unanswered outbounds
                        let unansweredCount = 0;
                        for (let i = emailMessages.length - 1; i >= 0; i--) {
                          if (emailMessages[i].direction === 'outbound') unansweredCount++;
                          else break;
                        }
                        
                        if (unansweredCount >= 5) {
                          return (
                            <div className="flex items-center gap-2 text-xs pt-2 border-t mt-2">
                              <Mail className="h-3 w-3 text-red-500 flex-shrink-0" />
                              <span className="text-red-600 font-medium">Follow-up encerrado (5 tentativas sem resposta)</span>
                            </div>
                          );
                        }
                        
                        const nextFollowUp = new Date(lastOutbound.getTime() + 24 * 60 * 60 * 1000);
                        const now = new Date();
                        const isPast = nextFollowUp <= now;
                        const diffMs = Math.abs(nextFollowUp.getTime() - now.getTime());
                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        
                        const timeStr = isPast 
                          ? 'Processando...' 
                          : diffHours > 0 
                            ? `em ${diffHours}h${diffMinutes > 0 ? ` ${diffMinutes}min` : ''}`
                            : `em ${diffMinutes}min`;
                        
                        return (
                          <div className="flex items-center gap-2 text-xs pt-2 border-t mt-2">
                            <Mail className="h-3 w-3 text-blue-500 flex-shrink-0" />
                            <span className="text-blue-600 font-medium">
                              📬 Próximo follow-up #{unansweredCount + 1}: {timeStr}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Timeline de Status */}
              <Card className="mb-4">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Linha do Tempo</h3>
                  <div className="flex items-center overflow-x-auto pb-2">
                    {(() => {
                      // Criar lista de eventos cronológicos reais
                      interface TimelineEvent {
                        label: string;
                        date: Date;
                        dateStr: string;
                        color: string;
                      }
                      
                      const events: TimelineEvent[] = [];
                      
                      // Cores por status
                      const statusColors: Record<string, string> = {
                        'Em Aberto': 'hsl(var(--muted-foreground))',
                        'Negociação': 'hsl(45, 93%, 47%)',
                        'Ganho': 'hsl(142, 76%, 36%)',
                        'Produzido': 'hsl(262, 83%, 58%)',
                        'Entregue': 'hsl(221, 83%, 53%)',
                        'Perdido': 'hsl(0, 84%, 60%)',
                        'Reaberto': 'hsl(38, 92%, 50%)'
                      };
                      
                      // Sempre começa com Em Aberto (created_at)
                      events.push({
                        label: 'Em Aberto',
                        date: new Date(lead.created_at),
                        dateStr: lead.created_at,
                        color: statusColors['Em Aberto']
                      });
                      
                      // Adicionar todos os eventos com timestamps
                      if (lead.negociacao_at) {
                        events.push({
                          label: 'Negociação',
                          date: new Date(lead.negociacao_at),
                          dateStr: lead.negociacao_at,
                          color: statusColors['Negociação']
                        });
                      }
                      
                      if (lead.ganho_at) {
                        events.push({
                          label: 'Ganho',
                          date: new Date(lead.ganho_at),
                          dateStr: lead.ganho_at,
                          color: statusColors['Ganho']
                        });
                      }
                      
                      if (lead.produzido_at) {
                        events.push({
                          label: 'Produzido',
                          date: new Date(lead.produzido_at),
                          dateStr: lead.produzido_at,
                          color: statusColors['Produzido']
                        });
                      }
                      
                      if (lead.delivered_at) {
                        events.push({
                          label: 'Entregue',
                          date: new Date(lead.delivered_at),
                          dateStr: lead.delivered_at,
                          color: statusColors['Entregue']
                        });
                      }
                      
                      if (lead.perdido_at) {
                        events.push({
                          label: 'Perdido',
                          date: new Date(lead.perdido_at),
                          dateStr: lead.perdido_at,
                          color: statusColors['Perdido']
                        });
                      }
                      
                      if (lead.reopened_at) {
                        events.push({
                          label: 'Reaberto',
                          date: new Date(lead.reopened_at),
                          dateStr: lead.reopened_at,
                          color: statusColors['Reaberto']
                        });
                      }
                      
                      // Ordenar por data cronológica
                      events.sort((a, b) => a.date.getTime() - b.date.getTime());
                      
                      // Calcular dias entre eventos consecutivos
                      const timelineWithDays = events.map((event, idx) => {
                        let daysInStatus: number | undefined;
                        if (idx < events.length - 1) {
                          // Dias até o próximo evento
                          daysInStatus = differenceInDays(events[idx + 1].date, event.date);
                        } else {
                          // Último evento: dias até hoje (se não for status final)
                          const finalStatuses = ['Entregue', 'Perdido'];
                          if (!finalStatuses.includes(event.label)) {
                            daysInStatus = differenceInDays(new Date(), event.date);
                          }
                        }
                        return { ...event, daysInStatus };
                      });
                      
                      return timelineWithDays.map((item, idx) => (
                        <div key={idx} className="flex items-center">
                          <div className="flex flex-col items-center min-w-[100px]">
                            <div 
                              className="w-4 h-4 rounded-full border-2"
                              style={{ 
                                borderColor: item.color,
                                backgroundColor: item.color
                              }}
                            />
                            <span className="text-xs font-medium mt-1">{item.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(item.date, "dd/MM/yy", { locale: ptBR })}
                            </span>
                            {item.daysInStatus !== undefined && item.daysInStatus > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ({item.daysInStatus} dias)
                              </span>
                            )}
                          </div>
                          {idx < timelineWithDays.length - 1 && (
                            <div 
                              className="h-0.5 w-8 mx-1"
                              style={{ backgroundColor: timelineWithDays[idx + 1].color }}
                            />
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Status */}
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground block mb-2">Status</label>
                      <div className="flex flex-col md:flex-row gap-2">
                        <select
                          value={lead.status || ''}
                          onChange={async (e) => {
                            try {
                              const statusValue = e.target.value as LeadStatus || null;
                              if (!statusValue) return;
                              
                              // Usar função centralizada - só seta timestamps, nunca limpa
                              const updateData = buildStatusUpdateData(statusValue, lead);
                              
                              const { error } = await supabase
                                .from('leads')
                                .update(updateData)
                                .eq('id', lead.id);

                              if (error) throw error;

                              setLead({ ...lead, ...updateData });
                              toast({
                                title: 'Status atualizado',
                                description: 'O status foi atualizado com sucesso.',
                              });
                            } catch (error) {
                              console.error('Erro ao atualizar status:', error);
                              toast({
                                title: 'Erro',
                                description: 'Não foi possível atualizar o status.',
                                variant: 'destructive',
                              });
                            }
                          }}
                          className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          {!lead.status && <option value="">Selecione...</option>}
                          <option value="em_aberto">Em Aberto</option>
                          <option value="em_negociacao">Em Negociação</option>
                          <option value="ganho">Ganho</option>
                          <option value="produzido">Produzido</option>
                          <option value="entregue">Entregue</option>
                          <option value="perdido">Perdido</option>
                        </select>
                        
                        {/* Botões de atalho - só mostra se o status for diferente */}
                        
                        {/* Em Aberto - mostra se em_negociacao ou perdido (voltar) */}
                        {(lead.status === 'em_negociacao' || lead.status === 'perdido') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                const updateData = buildStatusUpdateData('em_aberto', lead);
                                const { error } = await supabase
                                  .from('leads')
                                  .update(updateData)
                                  .eq('id', lead.id);

                                if (error) throw error;

                                setLead({ ...lead, ...updateData });
                                toast({
                                  title: 'Status atualizado',
                                  description: 'Lead marcado como Em Aberto',
                                });
                              } catch (error) {
                                console.error('Erro ao atualizar status:', error);
                                toast({
                                  title: 'Erro',
                                  description: 'Não foi possível atualizar o status.',
                                  variant: 'destructive',
                                });
                              }
                            }}
                            className="bg-gray-50 text-gray-700 hover:bg-gray-100 px-4 py-2 h-10 font-semibold text-sm whitespace-nowrap"
                          >
                            Em Aberto
                          </Button>
                        )}

                        {/* Em Negociação - mostra se ganho ou perdido */}
                        {(lead.status === 'ganho' || lead.status === 'perdido') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                const updateData = buildStatusUpdateData('em_negociacao', lead);
                                const { error } = await supabase
                                  .from('leads')
                                  .update(updateData)
                                  .eq('id', lead.id);

                                if (error) throw error;

                                setLead({ ...lead, ...updateData });
                                toast({
                                  title: 'Status atualizado',
                                  description: 'Lead marcado como Em Negociação',
                                });
                              } catch (error) {
                                console.error('Erro ao atualizar status:', error);
                                toast({
                                  title: 'Erro',
                                  description: 'Não foi possível atualizar o status.',
                                  variant: 'destructive',
                                });
                              }
                            }}
                            className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 h-10 font-semibold text-sm whitespace-nowrap"
                          >
                            Negociação
                          </Button>
                        )}
                        
                        {/* Ganho - só mostra se NÃO estiver ganho */}
                        {lead.status !== 'ganho' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                const updateData = buildStatusUpdateData('ganho', lead);
                                const { error } = await supabase
                                  .from('leads')
                                  .update(updateData)
                                  .eq('id', lead.id);

                                if (error) throw error;

                                setLead({ ...lead, ...updateData });
                                toast({
                                  title: 'Status atualizado',
                                  description: 'Lead marcado como Ganho',
                                });
                              } catch (error) {
                                console.error('Erro ao atualizar status:', error);
                                toast({
                                  title: 'Erro',
                                  description: 'Não foi possível atualizar o status.',
                                  variant: 'destructive',
                                });
                              }
                            }}
                            className="bg-green-50 text-green-700 hover:bg-green-100 px-4 py-2 h-10 font-semibold text-sm whitespace-nowrap"
                          >
                            <CheckCircle className="h-4 w-4 mr-1.5" />
                            GANHO
                          </Button>
                        )}
                        
                        {/* Perdido - só mostra se NÃO estiver perdido */}
                        {lead.status !== 'perdido' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                const updateData = buildStatusUpdateData('perdido', lead);
                                const { error } = await supabase
                                  .from('leads')
                                  .update(updateData)
                                  .eq('id', lead.id);

                                if (error) throw error;

                                setLead({ ...lead, ...updateData });
                                toast({
                                  title: 'Status atualizado',
                                  description: 'Lead marcado como Perdido',
                                });
                              } catch (error) {
                                console.error('Erro ao atualizar status:', error);
                                toast({
                                  title: 'Erro',
                                  description: 'Não foi possível atualizar o status.',
                                  variant: 'destructive',
                                });
                              }
                            }}
                            className="bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2 h-10 font-semibold text-sm whitespace-nowrap"
                          >
                            <XCircle className="h-4 w-4 mr-1.5" />
                            PERDIDO
                          </Button>
                        )}

                        {/* Entregue - só mostra se estiver ganho */}
                        {lead.status === 'ganho' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                const updateData = buildStatusUpdateData('entregue', lead);
                                const { error } = await supabase
                                  .from('leads')
                                  .update(updateData)
                                  .eq('id', lead.id);

                                if (error) throw error;

                                setLead({ ...lead, ...updateData });
                                toast({
                                  title: 'Status atualizado',
                                  description: 'Lead marcado como Entregue',
                                });
                              } catch (error) {
                                console.error('Erro ao atualizar status:', error);
                                toast({
                                  title: 'Erro',
                                  description: 'Não foi possível atualizar o status.',
                                  variant: 'destructive',
                                });
                              }
                            }}
                            className="bg-purple-50 text-purple-700 hover:bg-purple-100 px-4 py-2 h-10 font-semibold text-sm whitespace-nowrap"
                          >
                            <CheckCircle className="h-4 w-4 mr-1.5" />
                            ENTREGUE
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Produto */}
                    <div className="w-full lg:w-40">
                      <label className="text-xs text-muted-foreground block mb-2">Produto</label>
                      <select
                        value={lead.produto || ''}
                        onChange={async (e) => {
                          try {
                            const produtoValue = e.target.value || null;
                            
                            const { error } = await supabase
                              .from('leads')
                              .update({ produto: produtoValue })
                              .eq('id', lead.id);

                            if (error) throw error;

                            setLead({ ...lead, produto: produtoValue as any });
                            toast({
                              title: 'Produto atualizado',
                              description: 'O produto foi atualizado com sucesso.',
                            });
                          } catch (error) {
                            console.error('Erro ao atualizar produto:', error);
                            toast({
                              title: 'Erro',
                              description: 'Não foi possível atualizar o produto.',
                              variant: 'destructive',
                            });
                          }
                        }}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                      >
                        <option value="">Não definido</option>
                        <option value="palestra">Palestra</option>
                        <option value="consultoria">Consultoria</option>
                        <option value="mentoria">Mentoria</option>
                        <option value="treinamento">Treinamento</option>
                        <option value="publicidade">Publicidade</option>
                      </select>
                    </div>
                    
                    {/* Subtipo Publicidade */}
                    {lead.produto === 'publicidade' && (
                      <div className="w-full lg:w-48">
                        <label className="text-xs text-muted-foreground block mb-2">Subtipo</label>
                        <select
                          value={lead.publicidade_subtipo || ''}
                          onChange={async (e) => {
                            try {
                              const subtipoValue = e.target.value || null;
                              const { error } = await supabase
                                .from('leads')
                                .update({ publicidade_subtipo: subtipoValue } as any)
                                .eq('id', lead.id);
                              if (error) throw error;
                              setLead({ ...lead, publicidade_subtipo: subtipoValue as any });
                              toast({ title: 'Subtipo atualizado' });
                            } catch (error) {
                              console.error('Erro ao atualizar subtipo:', error);
                              toast({ title: 'Erro', description: 'Não foi possível atualizar o subtipo.', variant: 'destructive' });
                            }
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                        >
                          <option value="">Não definido</option>
                          <option value="instagram">Instagram (vídeo curto)</option>
                          <option value="youtube">YouTube (vídeo longo)</option>
                          <option value="youtube_instagram">YouTube + Instagram</option>
                        </select>
                      </div>
                    )}
                    
                    {/* Valor */}
                    <div className="w-full lg:w-48">
                      <label className="text-xs text-muted-foreground block mb-2">Valor</label>
                      {editingValor ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              value={tempValor}
                              onChange={(e) => setTempValor(e.target.value)}
                              placeholder="0.00"
                              className="flex-1 h-9"
                            />
                            <select
                              value={tempMoeda}
                              onChange={(e) => setTempMoeda(e.target.value as 'BRL' | 'USD' | 'EUR')}
                              className="w-20 flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                            >
                              <option value="BRL">BRL</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7" onClick={handleSaveValor}>
                              <Save className="h-3 w-3 mr-1" />
                              Salvar
                            </Button>
                            <Button size="sm" variant="outline" className="h-7" onClick={() => setEditingValor(false)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 h-9">
                          {lead.valor !== null && lead.valor !== undefined ? (
                            <span className="text-sm font-semibold">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: lead.moeda || 'BRL' }).format(lead.valor)}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Indefinido</span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="p-1 h-7"
                            onClick={() => {
                              setTempValor(lead.valor ? lead.valor.toString() : '');
                              setTempMoeda(lead.moeda || 'BRL');
                              setEditingValor(true);
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Probabilidade de Fechamento */}
                    <div className="w-full lg:w-40">
                      <label className="text-xs text-muted-foreground block mb-2">Chance de Fechar</label>
                      {editingProbability ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={tempProbability}
                              onChange={(e) => setTempProbability(e.target.value)}
                              placeholder="0-100"
                              className="flex-1 h-9"
                            />
                            <span className="flex items-center text-sm">%</span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7" onClick={async () => {
                              if (!lead) return;
                              try {
                                const probabilityNum = tempProbability ? Math.min(100, Math.max(0, parseInt(tempProbability))) : null;
                                
                                const { error } = await supabase
                                  .from('leads')
                                  .update({ ai_close_probability: probabilityNum })
                                  .eq('id', lead.id);

                                if (error) throw error;

                                setLead({ ...lead, ai_close_probability: probabilityNum });
                                setEditingProbability(false);
                                toast({
                                  title: 'Probabilidade atualizada',
                                  description: 'A probabilidade de fechamento foi atualizada.',
                                });
                              } catch (error) {
                                console.error('Erro ao salvar probabilidade:', error);
                                toast({
                                  title: 'Erro',
                                  description: 'Não foi possível salvar a probabilidade.',
                                  variant: 'destructive',
                                });
                              }
                            }}>
                              <Save className="h-3 w-3 mr-1" />
                              Salvar
                            </Button>
                            <Button size="sm" variant="outline" className="h-7" onClick={() => setEditingProbability(false)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 h-9">
                          {lead.ai_close_probability !== null && lead.ai_close_probability !== undefined ? (
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`text-sm font-semibold cursor-help ${
                                    lead.ai_close_probability >= 70 
                                      ? 'text-green-600' 
                                      : lead.ai_close_probability >= 40 
                                        ? 'text-yellow-600' 
                                        : 'text-red-600'
                                  }`}>
                                    {lead.ai_close_probability}%
                                  </span>
                                </TooltipTrigger>
                                {lead.ai_diagnosis_reason && (
                                  <TooltipContent side="bottom" className="max-w-xs">
                                    <p className="font-medium mb-1">Justificativa da IA:</p>
                                    <p className="text-muted-foreground whitespace-pre-wrap text-xs">{lead.ai_diagnosis_reason}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-sm text-muted-foreground">Não calculado</span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="p-1 h-7"
                            onClick={() => {
                              setTempProbability(lead.ai_close_probability ? lead.ai_close_probability.toString() : '');
                              setEditingProbability(true);
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Proposta info */}
                    {lead.produto === 'palestra' && lead.proposal_url && (
                      <div className="w-full lg:w-auto lg:border-l lg:pl-4">
                        <label className="text-xs text-muted-foreground block mb-2">Proposta</label>
                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          <span>Visualizações: <span className="font-semibold text-primary">{lead.proposal_view_count || 0}</span></span>
                          {lead.proposal_last_viewed_at && (
                            <span className="text-muted-foreground">
                              Última: {formatDistanceToNow(new Date(lead.proposal_last_viewed_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          )}
                          {lead.proposal_sent_at && (
                            <span className="text-muted-foreground">
                              Enviada: {formatDistanceToNow(new Date(lead.proposal_sent_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          )}
                          <a
                            href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/view-proposal?id=${lead.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            Abrir
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Valor Pago - para status ganho ou produzido */}
                  {(lead.status === 'ganho' || lead.status === 'produzido') && lead.valor && (
                    <div className="mt-4 pt-3 border-t">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Valor total:</span>
                          <span className="text-sm font-semibold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: lead.moeda || 'BRL' }).format(lead.valor)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Já pago:</span>
                          {editingValorPago ? (
                            <div className="flex gap-2 items-center">
                              <Input
                                type="number"
                                value={tempValorPago}
                                onChange={(e) => setTempValorPago(e.target.value)}
                                placeholder="0.00"
                                className="w-24 h-7"
                              />
                              <Button size="sm" className="h-7" onClick={handleSaveValorPago}>
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" className="h-7" onClick={() => setEditingValorPago(false)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="text-sm font-semibold text-green-600">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: lead.moeda || 'BRL' }).format(lead.valor_pago || 0)}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="p-1 h-6"
                                onClick={() => {
                                  setTempValorPago(lead.valor_pago ? lead.valor_pago.toString() : '0');
                                  setEditingValorPago(true);
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                        {(lead.valor - (lead.valor_pago || 0)) > 0 && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">A receber:</span>
                              <span className="text-sm font-bold text-orange-600">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: lead.moeda || 'BRL' }).format(lead.valor - (lead.valor_pago || 0))}
                              </span>
                            </div>
                            {/* Data do próximo pagamento */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Próx. Pagamento:</span>
                              {editingDataPagamento ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="date"
                                    value={tempDataPagamento}
                                    onChange={(e) => setTempDataPagamento(e.target.value)}
                                    className="w-36 h-7"
                                  />
                                  <Button size="sm" className="h-7" onClick={handleSaveDataPagamento}>
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7" onClick={() => setEditingDataPagamento(false)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  {lead.data_proximo_pagamento ? (
                                    <span className={`text-sm font-semibold ${
                                      new Date(lead.data_proximo_pagamento) < new Date() 
                                        ? 'text-red-600' 
                                        : 'text-blue-600'
                                    }`}>
                                      {new Date(lead.data_proximo_pagamento).toLocaleDateString('pt-BR')}
                                      {new Date(lead.data_proximo_pagamento) < new Date() && ' ⚠️ Atrasado'}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-muted-foreground italic">Não definido</span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="p-1 h-6"
                                    onClick={() => {
                                      setTempDataPagamento(lead.data_proximo_pagamento || '');
                                      setEditingDataPagamento(true);
                                    }}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notas */}
              {leadNotes.length > 0 && (
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <StickyNote className="h-4 w-4" />
                      Notas ({leadNotes.length})
                    </h3>
                    <div className="space-y-2">
                      {leadNotes.map((note) => (
                        <details key={note.id} className="bg-muted/50 rounded-md group">
                          <summary className="p-3 cursor-pointer list-none flex items-center gap-3 hover:bg-muted/70 rounded-md transition-colors">
                            <span className="text-sm text-foreground flex-1 truncate">
                              {note.note.length > 60 ? note.note.substring(0, 60) + '...' : note.note}
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180 flex-shrink-0" />
                          </summary>
                          <div className="px-3 pb-3 pt-1 border-t border-border/50">
                            <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                          </div>
                        </details>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Arquivos / Anexos */}
              {emailAttachments.length > 0 && (
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      Arquivos ({emailAttachments.length})
                    </h3>
                    <div className="space-y-2">
                      {emailAttachments.map((att) => {
                        const isImage = att.content_type?.startsWith('image/');
                        const sizeKB = att.size_bytes ? (att.size_bytes / 1024).toFixed(1) : null;
                        const sizeMB = att.size_bytes && att.size_bytes > 1024 * 1024 ? (att.size_bytes / (1024 * 1024)).toFixed(1) : null;
                        const sizeLabel = sizeMB ? `${sizeMB} MB` : sizeKB ? `${sizeKB} KB` : '';
                        
                        const handleDownload = async () => {
                          const { data, error } = await supabase.storage
                            .from('email-attachments')
                            .createSignedUrl(att.storage_path, 3600);
                          if (data?.signedUrl) {
                            window.open(data.signedUrl, '_blank');
                          } else {
                            console.error('Error getting signed URL:', error);
                          }
                        };

                        const handleDeleteAttachment = async (e: React.MouseEvent) => {
                          e.stopPropagation();
                          const { error } = await supabase
                            .from('email_attachments')
                            .update({ deleted_at: new Date().toISOString() } as any)
                            .eq('id', att.id);
                          if (!error) {
                            setEmailAttachments(prev => prev.filter(a => a.id !== att.id));
                            toast({ title: 'Arquivo removido', description: `"${att.filename}" não será mais importado automaticamente.` });
                          }
                        };

                        return (
                          <div
                            key={att.id}
                            className="flex items-center gap-3 p-2 bg-muted/50 rounded-md hover:bg-muted/70 transition-colors group"
                          >
                            <div className="flex items-center gap-3 flex-1 cursor-pointer min-w-0" onClick={handleDownload}>
                              {isImage ? (
                                <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                              ) : (
                                <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <span className="text-sm text-foreground truncate flex-1">{att.filename}</span>
                              {sizeLabel && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{sizeLabel}</span>
                              )}
                              <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              onClick={handleDeleteAttachment}
                              title="Remover arquivo (não será mais importado)"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {previousOpportunities.length > 0 && (
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Oportunidades Anteriores</h3>
                    <div className="space-y-2">
                      {previousOpportunities.map((opp) => (
                        <div 
                          key={opp.id} 
                          className="flex items-center gap-3 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded-md -mx-2 transition-colors"
                          onClick={() => window.open(`/opportunity/${opp.id}`, '_blank')}
                        >
                          <Badge variant="outline">{opp.produto || 'N/A'}</Badge>
                          <span>
                            {opp.valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: opp.moeda || 'BRL' }).format(opp.valor) : 'N/A'}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(opp.delivered_at), { addSuffix: true, locale: ptBR })}
                          </span>
                          <span className="text-primary text-xs ml-auto">Ver →</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Mensagens - Tabs Email/WhatsApp */}
              <Card>
                <CardContent className="p-4">
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'email' | 'whatsapp')}>
                    <div className="flex items-center justify-between mb-4">
                      <TabsList>
                        <TabsTrigger value="email" className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email {loadingMessages ? '' : `(${emailMessages.length})`}
                        </TabsTrigger>
                        <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp {loadingMessages ? '' : `(${whatsappMessages.length})`}
                        </TabsTrigger>
                      </TabsList>
                      
                      {/* Ações contextuais baseadas na aba ativa */}
                      {activeTab === 'email' && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() => setShowEmailImportDialog(true)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Importar
                          </Button>
                          <Button 
                            onClick={handleGenerateEmail} 
                            variant="default" 
                            size="sm"
                            disabled={generatingEmail}
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            {generatingEmail ? 'Gerando...' : 'Gerar Email'}
                          </Button>
                        </div>
                      )}
                      
                      {activeTab === 'whatsapp' && (
                        <div className="flex items-center gap-2">
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0"
                                  onClick={handleSyncWhatsAppLid}
                                  disabled={syncingWhatsAppLid}
                                >
                                  <RefreshCw className={`h-4 w-4 ${syncingWhatsAppLid ? 'animate-spin' : ''}`} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Sincronizar WhatsApp (buscar mensagens órfãs)</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() => setShowWhatsAppImportDialog(true)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Importar
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <TabsContent value="email">
                      {showEmailComposer && (
                        <Card className="mb-4">
                          <CardContent className="p-4 space-y-3">
                            <div>
                              <label className="text-sm font-medium mb-1 block">Assunto</label>
                              <Input
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                placeholder="Assunto do email"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-1 block">Corpo</label>
                              <Textarea
                                value={emailBody}
                                onChange={(e) => setEmailBody(e.target.value)}
                                placeholder="Conteúdo do email"
                                rows={8}
                              />
                            </div>
                            {/* Attachments */}
                            <div>
                              <label className="text-sm font-medium mb-1 block">Anexos</label>
                              <input
                                ref={emailFileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  setEmailAttachmentFiles(prev => [...prev, ...files]);
                                  e.target.value = '';
                                }}
                              />
                              <div className="flex flex-wrap gap-2 mb-2">
                                {emailAttachmentFiles.map((file, idx) => (
                                  <div key={idx} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1 text-xs">
                                    <Paperclip className="h-3 w-3 shrink-0" />
                                    <span className="truncate max-w-[120px]">{file.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => setEmailAttachmentFiles(prev => prev.filter((_, i) => i !== idx))}
                                      className="ml-1 text-muted-foreground hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => emailFileInputRef.current?.click()}
                              >
                                <Paperclip className="h-4 w-4 mr-2" />
                                Adicionar anexo
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                onClick={handleSendEmail} 
                                disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                {sendingEmail ? 'Enviando...' : 'Enviar Email'}
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  setShowEmailComposer(false);
                                  setEmailAttachmentFiles([]);
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-4">
                          {loadingMessages ? (
                            <>
                              {[1, 2, 3].map((i) => (
                                <div key={i} className="p-3 rounded-lg bg-muted">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Skeleton className="h-5 w-16" />
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-20 ml-auto" />
                                  </div>
                                  <Skeleton className="h-4 w-full mb-1" />
                                  <Skeleton className="h-4 w-3/4" />
                                </div>
                              ))}
                            </>
                          ) : (
                            <>
                              {emailMessages.map((msg) => (
                                <div key={msg.id} className={`p-3 rounded-lg overflow-hidden ${msg.direction === 'inbound' ? 'bg-muted' : 'bg-primary/10'}`}>
                                  <div className="flex items-start gap-2 mb-2 min-w-0">
                                    <Badge variant={msg.direction === 'inbound' ? 'default' : 'secondary'} className="shrink-0">
                                      {msg.direction === 'inbound' ? 'Recebido' : 'Enviado'}
                                    </Badge>
                                    {msg.subject && <span className="font-medium text-sm truncate min-w-0 flex-1">{msg.subject}</span>}
                                    <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                                      {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true, locale: ptBR })}
                                    </span>
                                  </div>
                                  {msg.html_body ? (
                                    <div 
                                      className="text-sm prose prose-sm max-w-none"
                                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatEmailHtml(msg.html_body)) }}
                                    />
                                  ) : (
                                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                  )}
                                </div>
                              ))}
                              {emailMessages.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                  <Mail className="h-12 w-12 mb-3 opacity-50" />
                                  <p>Nenhuma mensagem de email</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                    
                    <TabsContent value="whatsapp">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-xs text-muted-foreground">
                          Enviadas: <span className="font-semibold text-foreground">{lead.whatsapp_outbound_count || 0}</span>{' '}
                          • Recebidas: <span className="font-semibold text-foreground">{lead.whatsapp_inbound_count || 0}</span>
                        </div>
                      </div>
                      {unlinkedWhatsappMessages.length > 0 && (
                        <div className="mb-3 rounded-md border border-border bg-muted/50 p-3 text-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              Encontrei <span className="font-semibold">{unlinkedWhatsappMessages.length}</span> mensagens do mesmo telefone que não estão vinculadas a este lead.
                            </div>
                            <AlertDialog>
                              <Button size="sm" variant="default">
                                Vincular aqui
                              </Button>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Vincular mensagens a esta oportunidade?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Isso vai mover essas mensagens para este lead (elas podem estar aparecendo em outro lugar).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleLinkWhatsappMessages} disabled={linkingWhatsappMessages}>
                                    {linkingWhatsappMessages ? 'Vinculando…' : 'Confirmar'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )}

                      {groupedPhones.length > 1 && (
                        <div className="flex gap-2 mb-4 flex-wrap">
                          {groupedPhones.map((phone) => (
                            <Button
                              key={phone}
                              size="sm"
                              variant={activePhoneTab === phone ? 'default' : 'outline'}
                              onClick={() => setActivePhoneTab(phone)}
                            >
                              {phone}
                            </Button>
                          ))}
                        </div>
                      )}
                      
                      <ScrollArea className="h-[350px]" data-whatsapp-scroll>
                        <div className="space-y-3 p-2 overflow-hidden">
                          {loadingMessages ? (
                            <>
                              {[1, 2, 3, 4].map((i) => (
                                <div key={i} className={`flex w-full ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[75%] min-w-0 p-3 rounded-lg ${i % 2 === 0 ? 'bg-green-600/20' : 'bg-muted'}`}>
                                    <Skeleton className="h-4 w-40 mb-1" />
                                    <Skeleton className="h-3 w-24" />
                                  </div>
                                </div>
                              ))}
                            </>
                          ) : (
                            <>
                              {messagesForDisplay.map((msg) => (
                                <div key={msg.id} className={`flex w-full ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[75%] min-w-0 p-3 rounded-lg break-words ${msg.direction === 'outbound' ? 'bg-green-600 text-white' : 'bg-muted'}`}>
                                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                                    <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-green-100' : 'text-muted-foreground'}`}>
                                      {msg.timestamp && formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true, locale: ptBR })}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              {messagesForDisplay.length === 0 && (
                                <p className="text-center text-muted-foreground py-8">Nenhuma mensagem encontrada</p>
                              )}
                            </>
                          )}
                        </div>
                      </ScrollArea>
                      
                      {activePhoneTab && (
                        <WhatsAppMessageInput onSend={handleSendDirectWhatsApp} />
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Dialog para adicionar nota */}
        <Dialog open={showAddNoteDialog} onOpenChange={setShowAddNoteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Nota</DialogTitle>
              <DialogDescription>
                Adicione uma nota sobre esta oportunidade
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Digite sua nota..."
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddNoteDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddNote} disabled={addingNote || !newNoteText.trim()}>
                {addingNote ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para email da proposta */}
        <Dialog open={showProposalEmailDialog} onOpenChange={setShowProposalEmailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Email da Proposta</DialogTitle>
              <DialogDescription>
                Revise e edite o email antes de enviar
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Assunto</label>
                <Input
                  value={proposalEmailSubject}
                  onChange={(e) => setProposalEmailSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Corpo</label>
                <Textarea
                  value={proposalEmailBody}
                  onChange={(e) => setProposalEmailBody(e.target.value)}
                  rows={10}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Será enviado para: {lead.emails?.join(', ') || lead.email}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProposalEmailDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSendProposalEmail} disabled={sendingProposalEmail}>
                <Send className="h-4 w-4 mr-2" />
                {sendingProposalEmail ? 'Enviando...' : 'Enviar Email'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para importar mensagens do WhatsApp */}
        <Dialog open={showWhatsAppImportDialog} onOpenChange={setShowWhatsAppImportDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Importar Mensagens do WhatsApp</DialogTitle>
              <DialogDescription>
                Cole a conversa do WhatsApp copiada e a IA irá estruturar as mensagens automaticamente, identificando quais são recebidas (do lead) e enviadas (suas respostas).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Textarea
                  placeholder="Cole aqui a conversa do WhatsApp..."
                  value={whatsappImportText}
                  onChange={(e) => setWhatsappImportText(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Dica:</strong> No WhatsApp, toque e segure uma mensagem, selecione "Mais", marque todas as mensagens da conversa e toque em "Encaminhar" → "Copiar".</p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowWhatsAppImportDialog(false);
                  setWhatsappImportText('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={importWhatsAppMessages}
                disabled={importingWhatsApp || !whatsappImportText.trim()}
              >
                {importingWhatsApp ? 'Importando...' : 'Importar Mensagens'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para importar emails */}
        <Dialog open={showEmailImportDialog} onOpenChange={setShowEmailImportDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Importar Histórico de Emails</DialogTitle>
              <DialogDescription>
                Cole o histórico de emails copiado e a IA irá estruturar as mensagens automaticamente, identificando quais são recebidas (do lead) e enviadas (suas respostas).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Textarea
                  placeholder="Cole aqui o histórico de emails..."
                  value={emailImportText}
                  onChange={(e) => setEmailImportText(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Dica:</strong> Selecione e copie o conteúdo do email diretamente do seu cliente de email (Gmail, Outlook, etc). A IA irá identificar cada mensagem individual e a direção (enviada/recebida).</p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEmailImportDialog(false);
                  setEmailImportText('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={importEmailMessages}
                disabled={importingEmail || !emailImportText.trim()}
              >
                {importingEmail ? 'Importando...' : 'Importar Emails'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default OpportunityDetail;
