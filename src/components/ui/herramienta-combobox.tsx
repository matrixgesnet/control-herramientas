'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Herramienta {
  id: string
  codigo: string
  nombre: string
  activo?: boolean
}

interface HerramientaComboboxProps {
  herramientas: Herramienta[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function HerramientaCombobox({
  herramientas,
  value,
  onChange,
  placeholder = 'Seleccionar herramienta...',
  disabled = false
}: HerramientaComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  // Filtrar herramientas activas y por búsqueda
  const herramientasFiltradas = React.useMemo(() => {
    const activas = herramientas.filter(h => h.activo !== false)
    if (!search) return activas
    
    const searchLower = search.toLowerCase()
    return activas.filter(h => 
      h.codigo.toLowerCase().includes(searchLower) ||
      h.nombre.toLowerCase().includes(searchLower)
    )
  }, [herramientas, search])

  // Encontrar la herramienta seleccionada para mostrar
  const selectedHerramienta = herramientas.find(h => h.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal overflow-hidden"
        >
          <span className="truncate">
            {selectedHerramienta 
              ? `${selectedHerramienta.codigo} - ${selectedHerramienta.nombre}`
              : placeholder
            }
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Buscar por código o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            <CommandEmpty>No se encontraron herramientas.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {herramientasFiltradas.map((herramienta) => (
                <CommandItem
                  key={herramienta.id}
                  value={herramienta.id}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? '' : currentValue)
                    setOpen(false)
                    setSearch('')
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === herramienta.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">
                    <span className="font-medium">{herramienta.codigo}</span>
                    {' - '}
                    <span className="text-muted-foreground">{herramienta.nombre}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
