import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const EVENT_NAME = 'open-command-palette';

export function useCommandPalette() {
  const open = () => window.dispatchEvent(new CustomEvent(EVENT_NAME));
  // We can add close or toggle if needed
  return { open };
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      // Close on Escape is often handled by cmdk or Dialog, but good to have explicit
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    const openHandler = () => setOpen(true);

    document.addEventListener('keydown', down);
    window.addEventListener(EVENT_NAME, openHandler);
    
    return () => {
      document.removeEventListener('keydown', down);
      window.removeEventListener(EVENT_NAME, openHandler);
    };
  }, []);

  // Simplified navigation helper
  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          >
            <Command className="w-full">
              <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Command.Input
                  placeholder="Type a command or search..."
                  className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  autoFocus
                />
              </div>
              <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden py-2">
                <Command.Empty className="py-6 text-center text-sm">No results found.</Command.Empty>
                
                <Command.Group heading="Navigation">
                  <Command.Item onSelect={() => runCommand(() => navigate('/dashboard'))} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                    Dashboard
                  </Command.Item>
                  <Command.Item onSelect={() => runCommand(() => navigate('/projects'))} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                    Projects
                  </Command.Item>
                   <Command.Item onSelect={() => runCommand(() => navigate('/users'))} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                    Users
                  </Command.Item>
                   <Command.Item onSelect={() => runCommand(() => navigate('/work'))} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                    Work Queue
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Actions">
                  <Command.Item className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                    Create new project...
                  </Command.Item>
                  <Command.Item className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                    Invite new user...
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
