import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, Plus, Pencil, Search, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface CategoryBadgeEditorProps {
  revenueId: string;
  companyId: string;
  currentCategoryId: string | null;
  currentCategoryName: string | null;
  onUpdate: () => void;
}

const CategoryBadgeEditor = ({ 
  revenueId, 
  companyId, 
  currentCategoryId, 
  currentCategoryName, 
  onUpdate 
}: CategoryBadgeEditorProps) => {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('company_revenue_categories')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (data) setCategories(data);
  };

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);

  const handleSelectCategory = async (categoryId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('company_revenues')
        .update({ category_id: categoryId })
        .eq('id', revenueId);

      if (error) throw error;
      
      toast.success('Categoria atualizada');
      setOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Erro ao atualizar categoria');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndSelect = async (name: string) => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      // Use the RPC we created or do it manually
      const { data: newCat, error: catError } = await supabase
        .from('company_revenue_categories')
        .insert({ company_id: companyId, name: name.trim() })
        .select()
        .single();

      if (catError) {
        // If it exists, try to find it
        const { data: existing } = await supabase
          .from('company_revenue_categories')
          .select('id')
          .eq('company_id', companyId)
          .ilike('name', name.trim())
          .maybeSingle();
        
        if (existing) {
          await handleSelectCategory(existing.id);
          return;
        }
        throw catError;
      }

      if (newCat) {
        await handleSelectCategory(newCat.id);
      }
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Erro ao criar categoria');
    } finally {
      setLoading(false);
    }
  };

  const Content = () => (
    <div className="p-0">
      <Command className="w-full">
        <CommandInput 
          placeholder="Buscar ou criar categoria..." 
          value={search}
          onValueChange={setSearch}
        />
        <CommandList className="max-h-[300px]">
          <CommandEmpty>
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">Nenhuma categoria encontrada.</p>
              {search && (
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => handleCreateAndSelect(search)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Criar "{search}"
                </Button>
              )}
            </div>
          </CommandEmpty>
          <CommandGroup heading="Categorias">
            {categories.map((category) => (
              <CommandItem
                key={category.id}
                value={category.name}
                onSelect={() => handleSelectCategory(category.id)}
                className="flex items-center justify-between"
              >
                <span>{category.name}</span>
                {currentCategoryId === category.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <div className="group relative cursor-pointer inline-block">
            <Badge variant="secondary" className="hover:bg-secondary/80 transition-colors py-1 px-2 pr-6">
              {currentCategoryName || '—'}
              <Pencil className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 opacity-50" />
            </Badge>
          </div>
        </DrawerTrigger>
        <DrawerContent className="p-0">
          <DrawerHeader>
            <DrawerTitle>Selecionar Categoria</DrawerTitle>
          </DrawerHeader>
          <div className="pb-8">
            <Content />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="group relative cursor-pointer inline-block">
          <Badge 
            variant="secondary" 
            className="hover:bg-secondary/80 transition-colors py-1 px-2 pr-6 min-w-[80px] text-center"
          >
            {currentCategoryName || '—'}
            <Pencil className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Badge>
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[200px]" align="start">
        <Content />
      </PopoverContent>
    </Popover>
  );
};

export default CategoryBadgeEditor;
