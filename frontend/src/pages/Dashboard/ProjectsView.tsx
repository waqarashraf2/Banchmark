import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../services/api';
import DataTable from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui';
import { Users, UserCheck, UserX, Package, CheckCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

/* ================= TYPES ================= */

interface ProjectStats {
    project_id: number;
    project_name: string;
    received_orders_today: number;
    completed_orders_today: number;
    received_done_orders?: number;
    done_orders_today?: number;
    done_orders?: number;
    untouched_orders: number;
    pending_orders: number;
    total_staff: number;
    present_staff: number;
    absent_staff: number;
}

interface ProjectStatsResponse {
    success: boolean;
    selected_date?: string;
    start_date?: string;
    end_date?: string;
    date_filter_type?: 'single_date' | 'date_range' | 'start_to_today';
    selected_role?: string;
    totals: {
        received_orders_today?: number;
        received_done_orders?: number;
        done_orders?: number;
        total_staff: number;
        present_staff: number;
        absent_staff: number;
    };
    projects: ProjectStats[];
    selected_project_breakdown?: ProjectBreakdownResponse;
}

interface Worker {
    name: string;
    done_count: number;
}

interface AssignmentWorkerLike {
    name: string;
    done_count?: number;
    today_completed?: number;
    wip_count?: number;
}

interface RoleBreakdown {
    role: string;
    label: string;
    total_today_received_done?: number;
    today_received_done: Worker[];
    total_today_done_all?: number;
    today_done_all: Worker[];
}

interface ProjectBreakdownResponse {
    project_id: number;
    project_name: string;
    selected_date?: string;
    start_date?: string;
    end_date?: string;
    date_filter_type?: 'single_date' | 'date_range' | 'start_to_today';
    selected_role?: string;
    total_received_done_orders?: number;
    total_done_orders?: number;
    roles: RoleBreakdown[];
}

type RoleCompletionEntry = {
    total_staff?: number;
    active?: number;
    today_completed?: number;
};

/* ================= COMPONENT ================= */

const ProjectsView: React.FC = () => {

    const roleLabelMap: Record<string, string> = {
        drawer: 'Drawer',
        checker: 'Checker',
        filler: 'Filler',
        designer: 'Designer',
        qa: 'QA'
    };

    const toRoleBreakdownFromWorkers = (
        source: {
            workers?: Record<string, AssignmentWorkerLike[] | undefined>;
            role_completions?: Record<string, RoleCompletionEntry | undefined>;
            project?: { id?: number; name?: string };
        },
        fallbackProjectId: number,
        fallbackProjectName: string,
        filters: {
            selectedDate: string;
            startDate: string | null;
            endDate: string;
            dateFilterType: 'single_date' | 'date_range' | 'start_to_today';
        }
    ): ProjectBreakdownResponse | null => {
        const workersByRole = source.workers || {};
        const roleCompletions = source.role_completions || {};
        const roleNames = Object.keys(workersByRole);

        if (roleNames.length === 0) return null;

        const roles: RoleBreakdown[] = roleNames.map((roleName) => {
            const workerList = workersByRole[roleName] || [];
            const normalizedWorkers: Worker[] = workerList.map((worker) => ({
                name: worker.name,
                done_count: Number(worker.done_count ?? worker.today_completed ?? 0),
            }));
            const completion = roleCompletions[roleName];
            const totalDone = Number(
                completion?.today_completed
                ?? normalizedWorkers.reduce((sum, worker) => sum + (worker.done_count || 0), 0)
            );

            return {
                role: roleName,
                label: roleLabelMap[roleName] || roleName,
                total_today_received_done: totalDone,
                today_received_done: normalizedWorkers,
                total_today_done_all: totalDone,
                today_done_all: normalizedWorkers,
            };
        });

        return {
            project_id: Number(source.project?.id ?? fallbackProjectId),
            project_name: source.project?.name || fallbackProjectName,
            selected_date: filters.dateFilterType === 'single_date' ? filters.selectedDate : undefined,
            start_date: filters.dateFilterType !== 'single_date' ? (filters.startDate || undefined) : undefined,
            end_date: filters.dateFilterType !== 'single_date' ? filters.endDate : undefined,
            date_filter_type: filters.dateFilterType,
            selected_role: undefined,
            total_received_done_orders: roles.reduce((sum, role) => sum + (role.total_today_received_done || 0), 0),
            total_done_orders: roles.reduce((sum, role) => sum + (role.total_today_done_all || 0), 0),
            roles,
        };
    };

    const [data, setData] = useState<ProjectStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [totals, setTotals] = useState<ProjectStatsResponse['totals'] | null>(null);

    // Date state management - supports three modes: single date, range, or start-to-today
    const today = new Date().toISOString().split('T')[0];

    const [selectedDate, setSelectedDate] = useState(today);
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState(today);
    const [dateFilterType, setDateFilterType] = useState<'single_date' | 'date_range' | 'start_to_today'>('single_date');

    /* inline breakdown state */
    const [selectedProject, setSelectedProject] = useState<ProjectStats | null>(null);
    const [breakdown, setBreakdown] = useState<ProjectBreakdownResponse | null>(null);
    const [loadingBreakdown, setLoadingBreakdown] = useState(false);

    const [activeTab, setActiveTab] = useState<'received' | 'done'>('received');

    /* ================= FETCH MAIN ================= */

    useEffect(() => {
        const fetch = async () => {
            try {
                setLoading(true);

                // Build params based on filter type
                const params: Record<string, string> = {};

                if (dateFilterType === 'single_date') {
                    params.date = selectedDate;
                } else if (dateFilterType === 'date_range') {
                    if (startDate) params.start_date = startDate;
                    params.end_date = endDate;
                } else if (dateFilterType === 'start_to_today') {
                    if (startDate) params.start_date = startDate;
                    // end_date defaults to today on backend, but we can specify it
                }

                const res = await apiClient.get<ProjectStatsResponse>(
                    '/dashboard/project-stats',
                    { params }
                );

                if (res.data.success) {
                    setData(res.data.projects);
                    setTotals(res.data.totals);
                }

            } catch {
                setData([]);
                setTotals(null);
            } finally {
                setLoading(false);
            }
        };

        fetch();
    }, [selectedDate, startDate, endDate, dateFilterType]);

    /* ================= INLINE BREAKDOWN ================= */

    const toggleProjectBreakdown = async (project: ProjectStats) => {
        if (selectedProject?.project_id === project.project_id) {
            setSelectedProject(null);
            setBreakdown(null);
            setLoadingBreakdown(false);
            return;
        }

        try {
            setSelectedProject(project);
            setBreakdown(null);
            setLoadingBreakdown(true);

            // Build params based on filter type, including project_id
            const params: Record<string, string> = {
                project_id: project.project_id.toString()
            };

            if (dateFilterType === 'single_date') {
                params.date = selectedDate;
            } else if (dateFilterType === 'date_range') {
                if (startDate) params.start_date = startDate;
                params.end_date = endDate;
            } else if (dateFilterType === 'start_to_today') {
                if (startDate) params.start_date = startDate;
            }

            const res = await apiClient.get('/dashboard/project-stats', {
                params
            });

            if (res.data.success) {
                const apiData = res.data as {
                    selected_project_breakdown?: ProjectBreakdownResponse | null;
                    workers?: Record<string, AssignmentWorkerLike[] | undefined>;
                    role_completions?: Record<string, RoleCompletionEntry | undefined>;
                    project?: { id?: number; name?: string };
                };

                const breakdownFromResponse = apiData.selected_project_breakdown;

                if (breakdownFromResponse && Array.isArray(breakdownFromResponse.roles) && breakdownFromResponse.roles.length > 0) {
                    setBreakdown(breakdownFromResponse);
                } else {
                    const fallbackBreakdown = toRoleBreakdownFromWorkers(
                        apiData,
                        project.project_id,
                        project.project_name,
                        { selectedDate, startDate, endDate, dateFilterType }
                    );
                    setBreakdown(fallbackBreakdown);
                }
            }

        } catch (err) {
            console.error(err);
            setBreakdown(null);
        } finally {
            setLoadingBreakdown(false);
        }
    };

    useEffect(() => {
        setSelectedProject(null);
        setBreakdown(null);
    }, [selectedDate, startDate, endDate, dateFilterType]);

    const visibleRoles = useMemo(() => {
        if (!Array.isArray(breakdown?.roles)) return [];

        const orderedRoles = ['drawer', 'checker', 'filler', 'designer', 'qa'];
        return breakdown.roles
            .slice()
            .sort((a, b) => {
                const aIndex = orderedRoles.indexOf(a.role);
                const bIndex = orderedRoles.indexOf(b.role);

                if (aIndex === -1 && bIndex === -1) return 0;
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;

                return aIndex - bIndex;
            });
    }, [breakdown]);

    const topDoneMetric = useMemo(() => {
        if (activeTab === 'received') {
            const value = totals?.received_done_orders
                ?? data.reduce((sum, project) => sum + (project.received_done_orders ?? 0), 0);

            return {
                label: 'Total Received Today Done',
                value
            };
        }

        const value = totals?.done_orders
            ?? data.reduce(
                (sum, project) => sum + (project.done_orders ?? project.done_orders_today ?? project.completed_orders_today ?? 0),
                0
            );

        return {
            label: 'Total Today Done',
            value
        };
    }, [activeTab, totals, data]);

    /* ================= UI ================= */

    return (
        <div className="px-0 md:px-6 py-6">
            <style>{`
                ::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                ::-webkit-scrollbar-track {
                    background: rgb(241, 245, 249);
                    border-radius: 4px;
                }
                ::-webkit-scrollbar-thumb {
                    background: rgb(42, 167, 160);
                    border-radius: 4px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: rgb(34, 138, 129);
                }
                /* Firefox */
                * {
                    scrollbar-color: rgb(42, 167, 160) rgb(241, 245, 249);
                    scrollbar-width: thin;
                }
            `}</style>

            <h1 className="text-xl md:text-2xl font-bold mb-4 px-4 md:px-0">
                Project Statistics
            </h1>

            {/* DATE FILTERS */}
            <div className="mb-6 px-4 md:px-0">
                <div className="bg-white rounded-xl ring-1 ring-black/[0.04] shadow-sm p-4 mb-4">
                    <div className="flex flex-col gap-3 md:gap-4">
                        {/* Filter Type Buttons */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setDateFilterType('single_date')}
                                className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-colors ${dateFilterType === 'single_date' ? 'bg-[#2AA7A0] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                Single Date
                            </button>
                            <button
                                onClick={() => setDateFilterType('date_range')}
                                className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-colors ${dateFilterType === 'date_range' ? 'bg-[#2AA7A0] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                Date Range
                            </button>
                            <button
                                onClick={() => setDateFilterType('start_to_today')}
                                className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-colors ${dateFilterType === 'start_to_today' ? 'bg-[#2AA7A0] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                Start to Today
                            </button>
                        </div>

                        {/* Date Inputs */}
                        <div className="flex flex-col md:flex-row gap-3">
                            {dateFilterType === 'single_date' && (
                                <div className="flex flex-col">
                                    <label className="text-xs md:text-sm font-medium text-slate-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="px-3 py-2 border border-slate-200 rounded-md text-sm"
                                    />
                                </div>
                            )}

                            {dateFilterType === 'date_range' && (
                                <>
                                    <div className="flex flex-col">
                                        <label className="text-xs md:text-sm font-medium text-slate-700 mb-1">Start Date</label>
                                        <input
                                            type="date"
                                            value={startDate || ''}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="px-3 py-2 border border-slate-200 rounded-md text-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs md:text-sm font-medium text-slate-700 mb-1">End Date</label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="px-3 py-2 border border-slate-200 rounded-md text-sm"
                                        />
                                    </div>
                                </>
                            )}

                            {dateFilterType === 'start_to_today' && (
                                <div className="flex flex-col">
                                    <label className="text-xs md:text-sm font-medium text-slate-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={startDate || ''}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="px-3 py-2 border border-slate-200 rounded-md text-sm"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tab Buttons */}
                <div className="flex flex-wrap gap-2">
                    <button
                        className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'received' ? 'bg-[#2AA7A0] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        onClick={() => setActiveTab('received')}
                    >
                        Today Received Done
                    </button>
                    <button
                        className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'done' ? 'bg-[#2AA7A0] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        onClick={() => setActiveTab('done')}
                    >
                        Today Done
                    </button>
                </div>
            </div>

            {/* STATS */}
            {totals && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6 px-4 md:px-0">
                    <StatCard label="Total Staff" value={totals.total_staff} icon={Users} color="blue" />
                    <StatCard label="Present Staff" value={totals.present_staff} icon={UserCheck} color="green" />
                    <StatCard label="Absent Staff" value={totals.absent_staff} icon={UserX} color="rose" />
                    <StatCard label="Received Today" value={totals.received_orders_today ?? 0} icon={Package} color="violet" />
                    <StatCard label={topDoneMetric.label} value={topDoneMetric.value} icon={CheckCircle} color="teal" />
                </div>
            )}

            {/* TABLE (UNCHANGED DESIGN) */}
            <div className="flex flex-col lg:flex-row gap-6">

                <div className="flex-[0_0_65%] px-4 md:px-0">
                    <h2 className="text-lg md:text-xl font-semibold mb-4">Projects Orders</h2>

                    <div className="bg-white rounded-xl overflow-hidden ring-1 ring-black/[0.04] shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="px-3 md:px-4 py-2.5 text-left text-[10px] md:text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider bg-slate-50/80">
                                            Project Name
                                        </th>
                                        <th className="px-3 md:px-4 py-2.5 text-center text-[10px] md:text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider bg-slate-50/80">
                                            Received Today
                                        </th>
                                        <th className="px-3 md:px-4 py-2.5 text-center text-[10px] md:text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider bg-slate-50/80">
                                            Completed Today
                                        </th>
                                        <th className="px-3 md:px-4 py-2.5 text-center text-[10px] md:text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider bg-slate-50/80">
                                            Pending Orders
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-10 text-center text-xs md:text-sm text-slate-400">
                                                Loading projects...
                                            </td>
                                        </tr>
                                    ) : data.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-10 text-center text-xs md:text-sm text-slate-400">
                                                No projects found.
                                            </td>
                                        </tr>
                                    ) : (
                                        data.map((project) => {
                                            const isOpen = selectedProject?.project_id === project.project_id;

                                            return (
                                                <React.Fragment key={project.project_id}>
                                                    <tr
                                                        onClick={() => toggleProjectBreakdown(project)}
                                                        className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                                                    >
                                                        <td className="px-3 md:px-4 py-2.5 md:py-3 text-[12px] md:text-[13px] text-ink-primary">
                                                            <div className="flex items-center gap-1.5 md:gap-2">
                                                                {isOpen ? (
                                                                    <ChevronUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#2AA7A0]" />
                                                                ) : (
                                                                    <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-400" />
                                                                )}
                                                                <span className="font-medium">{project.project_name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 md:px-4 py-2.5 md:py-3 text-[12px] md:text-[13px] text-center text-ink-primary">
                                                            {project.received_orders_today}
                                                        </td>
                                                        <td className="px-3 md:px-4 py-2.5 md:py-3 text-[12px] md:text-[13px] text-center text-ink-primary">
                                                            {project.completed_orders_today}
                                                        </td>
                                                        <td className="px-3 md:px-4 py-2.5 md:py-3 text-[12px] md:text-[13px] text-center text-ink-primary">
                                                            {project.pending_orders}
                                                        </td>
                                                    </tr>

                                                    {isOpen && (
                                                        <tr className="bg-slate-50/70">
                                                            <td colSpan={4} className="px-3 md:px-4 py-3 md:py-4">
                                                                {loadingBreakdown ? (
                                                                    <div className="flex items-center justify-center py-10">
                                                                        <Loader2 className="h-6 w-6 animate-spin text-[#2AA7A0]" />
                                                                    </div>
                                                                ) : visibleRoles.length > 0 ? (
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                                                        {visibleRoles.map((role) => {
                                                                            const workers = activeTab === 'received'
                                                                                ? role.today_received_done
                                                                                : role.today_done_all;
                                                                            const total = activeTab === 'received'
                                                                                ? role.total_today_received_done
                                                                                : role.total_today_done_all;

                                                                            return (
                                                                                <div key={role.role} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                                                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 bg-slate-50">
                                                                                        <div>
                                                                                            <h3 className="text-xs md:text-sm font-semibold text-slate-900">{role.label}</h3>
                                                                                            <p className="text-[10px] md:text-[11px] text-slate-500">
                                                                                                {activeTab === 'received' ? 'Today received done' : 'Today done'}
                                                                                            </p>
                                                                                        </div>
                                                                                        <span className="inline-flex items-center justify-center min-w-[1.75rem] rounded-md bg-[#2AA7A0]/10 px-2 py-0.5 text-xs md:text-sm font-semibold text-[#2AA7A0]">
                                                                                            {total}
                                                                                        </span>
                                                                                    </div>

                                                                                    <div className="max-h-[280px] md:max-h-[320px] overflow-auto">
                                                                                        {workers.length === 0 ? (
                                                                                            <div className="px-3 py-6 text-center text-xs md:text-sm text-slate-400">
                                                                                                No data
                                                                                            </div>
                                                                                        ) : (
                                                                                            <table className="w-full text-xs md:text-sm">
                                                                                                <thead className="sticky top-0 bg-white">
                                                                                                    <tr className="border-b border-slate-100">
                                                                                                        <th className="px-3 py-2 text-left text-[9px] md:text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                                                                                            Name
                                                                                                        </th>
                                                                                                        <th className="px-3 py-2 text-center text-[9px] md:text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                                                                                            Count
                                                                                                        </th>
                                                                                                    </tr>
                                                                                                </thead>
                                                                                                <tbody className="divide-y divide-slate-50">
                                                                                                    {workers.map((worker, index) => (
                                                                                                        <tr key={`${role.role}-${worker.name}-${index}`} className="hover:bg-slate-50/70">
                                                                                                            <td className="px-3 py-1.5 text-[10px] md:text-[11px] text-slate-800">{worker.name}</td>
                                                                                                            <td className="px-3 py-1.5 text-center">
                                                                                                                <span className="inline-flex items-center justify-center min-w-[1.5rem] rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] md:text-[10px] font-semibold text-slate-700">
                                                                                                                    {worker.done_count}
                                                                                                                </span>
                                                                                                            </td>
                                                                                                        </tr>
                                                                                                    ))}
                                                                                                </tbody>
                                                                                            </table>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    <div className="py-8 text-center text-xs md:text-sm text-slate-400">
                                                                        No breakdown data available for this project.
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* KEEP SAME STAFF TABLE */}
                <div className="flex-[0_0_35%] px-4 md:px-0">
                    <h2 className="text-lg md:text-xl font-semibold mb-4">Projects Staff</h2>

                    <DataTable
                        data={data}
                        loading={loading}
                        keyField="project_id"
                        columns={[
                            { key: 'project_name', label: 'Project Name' },
                            { key: 'total_staff', label: 'Total Staff', align: 'center' as const },
                            { key: 'present_staff', label: 'Present Staff', align: 'center' as const },
                            { key: 'absent_staff', label: 'Absent Staff', align: 'center' as const },
                        ]}
                    />
                </div>
            </div>

        </div>
    );
};

export default ProjectsView;
