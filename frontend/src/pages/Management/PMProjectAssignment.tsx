import { useEffect, useState, useCallback } from 'react';
import { pmService, projectService } from '../../services';
import type { Project } from '../../types';
import { AnimatedPage, PageHeader, Button } from '../../components/ui';
import { Briefcase, Save, RefreshCw, Check, FolderKanban, User, ChevronDown, ChevronUp } from 'lucide-react';
import ClockDisplay from '../../components/ClockDisplay';

interface PMUser {
  id: number;
  name: string;
  email: string;
  role: string;
  country: string;
  managed_projects: { id: number; code: string; name: string }[];
}

export default function PMProjectAssignment() {
  const [pms, setPMs] = useState<PMUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignments, setAssignments] = useState<Record<number, number[]>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPM, setExpandedPM] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const projectTz = projects.length > 0 ? (projects[0].timezone || 'Australia/Sydney') : 'Australia/Sydney';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pmRes, projRes] = await Promise.all([
        pmService.list(),
        projectService.list(),
      ]);
      const pmList = Array.isArray(pmRes.data) ? pmRes.data : [];
      const projData = projRes.data?.data || projRes.data;
      const projList = Array.isArray(projData) ? projData : [];

      setPMs(pmList);
      setProjects(projList);

      // Build assignments map: pmId -> [projectId, ...]
      const map: Record<number, number[]> = {};
      pmList.forEach((pm: PMUser) => {
        map[pm.id] = pm.managed_projects.map(p => p.id);
      });
      setAssignments(map);

      // Auto-expand first PM
      if (pmList.length > 0 && !expandedPM) {
        setExpandedPM(pmList[0].id);
      }
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleProject = (pmId: number, projectId: number) => {
    setAssignments(prev => {
      const current = prev[pmId] || [];
      const has = current.includes(projectId);
      return {
        ...prev,
        [pmId]: has ? current.filter(id => id !== projectId) : [...current, projectId],
      };
    });
  };

  const saveAssignment = async (pmId: number) => {
    setSaving(pmId);
    try {
      await pmService.assignProjects(pmId, assignments[pmId] || []);
      setSuccessMsg(`Projects saved for ${pms.find(p => p.id === pmId)?.name}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      // Reload to get fresh data
      await loadData();
    } catch (e) {
      console.error('Failed to save', e);
    } finally {
      setSaving(null);
    }
  };

  const hasChanges = (pmId: number) => {
    const pm = pms.find(p => p.id === pmId);
    if (!pm) return false;
    const original = pm.managed_projects.map(p => p.id).sort();
    const current = (assignments[pmId] || []).sort();
    if (original.length !== current.length) return true;
    return original.some((id, i) => id !== current[i]);
  };

  if (loading) {
    return (
      <AnimatedPage>
        <PageHeader title="PM Project Assignment" subtitle="Loading..." />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-slate-200/60 p-6 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-1">
        <PageHeader
          title="PM Project Assignment"
          subtitle="Assign projects to Project Managers — PMs can manage multiple projects"
          actions={
            <Button variant="secondary" icon={RefreshCw} onClick={loadData}>
              Refresh
            </Button>
          }
        />
        <div className="text-right mt-2 sm:mt-0 flex-shrink-0">
          <ClockDisplay timezone={projectTz} className="text-sm font-semibold text-slate-800 font-mono" />
        </div>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-3 rounded-xl">
          <Check className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200/60 p-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500 font-medium">Project Managers</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{pms.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/60 p-4">
          <div className="flex items-center gap-2 mb-1">
            <FolderKanban className="w-4 h-4 text-teal-500" />
            <span className="text-xs text-slate-500 font-medium">Total Projects</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{projects.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/60 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-slate-500 font-medium">Unassigned Projects</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {projects.filter(p => !pms.some(pm => (assignments[pm.id] || []).includes(p.id))).length}
          </div>
        </div>
      </div>

      {/* No PMs state */}
      {pms.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200/60 p-12 text-center">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Project Managers</h3>
          <p className="text-sm text-slate-500 mb-4">
            Create a user with the "Project Manager" role first, then come back here to assign projects.
          </p>
          <Button variant="primary" onClick={() => window.location.href = '/users'}>
            Go to User Management
          </Button>
        </div>
      )}

      {/* PM Cards */}
      <div className="space-y-4">
        {pms.map(pm => {
          const isExpanded = expandedPM === pm.id;
          const changed = hasChanges(pm.id);
          const assignedCount = (assignments[pm.id] || []).length;

          return (
            <div
              key={pm.id}
              className={`bg-white rounded-xl border transition-all ${
                changed ? 'border-amber-300 shadow-amber-100 shadow-md' : 'border-slate-200/60'
              }`}
            >
              {/* PM Header */}
              <button
                onClick={() => setExpandedPM(isExpanded ? null : pm.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/50 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-sm">
                    {pm.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{pm.name}</div>
                    <div className="text-xs text-slate-500">{pm.email} · {pm.country}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    assignedCount > 0 ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {assignedCount} project{assignedCount !== 1 ? 's' : ''} assigned
                  </span>
                  {changed && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      Unsaved
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Expandable project list */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-100">
                  <div className="pt-4 mb-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                      Select projects to assign
                    </h4>
                  </div>

                  {projects.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">No projects available</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {projects.map(project => {
                        const isAssigned = (assignments[pm.id] || []).includes(project.id);
                        // Check if another PM has this project
                        const otherPM = pms.find(
                          otherPm => otherPm.id !== pm.id && (assignments[otherPm.id] || []).includes(project.id)
                        );

                        return (
                          <button
                            key={project.id}
                            onClick={() => toggleProject(pm.id, project.id)}
                            className={`relative text-left p-4 rounded-lg border-2 transition-all ${
                              isAssigned
                                ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-200'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {/* Checkbox indicator */}
                            <div className={`absolute top-3 right-3 w-5 h-5 rounded flex items-center justify-center ${
                              isAssigned ? 'bg-brand-500 text-white' : 'border-2 border-slate-300'
                            }`}>
                              {isAssigned && <Check className="w-3.5 h-3.5" />}
                            </div>

                            <div className="pr-8">
                              <div className="text-sm font-semibold text-slate-900">{project.name}</div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {project.code} · {project.country}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                  project.department === 'floor_plan'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-pink-100 text-pink-700'
                                }`}>
                                  {project.department === 'floor_plan' ? 'Floor Plan' : 'Photos'}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                  project.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {project.status}
                                </span>
                              </div>
                              {otherPM && !isAssigned && (
                                <div className="text-[10px] text-slate-500 mt-2">
                                  Also assigned to {otherPM.name}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Save button */}
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                    <div className="text-xs text-slate-500">
                      {assignedCount === 0 ? 'No projects selected' : `${assignedCount} project${assignedCount !== 1 ? 's' : ''} selected`}
                    </div>
                    <Button
                      variant="primary"
                      icon={Save}
                      onClick={() => saveAssignment(pm.id)}
                      loading={saving === pm.id}
                      disabled={!changed}
                    >
                      {changed ? 'Save Changes' : 'No Changes'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AnimatedPage>
  );
}
