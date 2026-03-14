import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  RefreshCw, 
  ExternalLink, 
  Unlink,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Webhook,
  ChevronDown,
  ChevronUp,
  X,
  Check
} from "lucide-react";
import { MicrosoftPlannerIcon } from "@/components/icons/microsoft-icons";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PlannerConnectionDialog } from "./PlannerConnectionDialog";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PlannerStatusPanelProps {
  projectId: string;
  projectName: string;
  clientName?: string;
  clientTeamId?: string;
  clientId?: string;
}

interface SyncLogEntry {
  id: string;
  direction: string;
  action: string;
  allocationId?: string;
  taskId?: string;
  details?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface SyncRecord {
  id: string;
  allocationId: string;
  taskId: string;
  taskTitle: string;
  bucketName: string;
  syncStatus: string;
  syncError?: string;
  lastSyncedAt: string;
}

interface SyncStatus {
  connected: boolean;
  connection?: {
    planId: string;
    planTitle: string;
    groupId?: string;
    groupName?: string;
    syncEnabled: boolean;
    syncDirection: string;
    autoAddMembers?: boolean;
    lastSyncAt?: string;
    lastSyncStatus?: string;
    lastInboundSyncAt?: string;
    lastOutboundSyncAt?: string;
    webhookActive?: boolean;
  };
  syncedTasks: number;
  conflictCount?: number;
  syncs?: SyncRecord[];
  unresolvedLogs?: SyncLogEntry[];
  recentLogs?: SyncLogEntry[];
}

export function PlannerStatusPanel({ projectId, projectName, clientName, clientTeamId, clientId }: PlannerStatusPanelProps) {
  const { toast } = useToast();
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);

  const { data: syncStatus, isLoading } = useQuery<SyncStatus>({
    queryKey: ["/api/projects", projectId, "planner-sync-status"]
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/projects/${projectId}/planner-sync`, {
        method: "POST"
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "planner-sync-status"] });
      const parts = [];
      if (result.created) parts.push(`${result.created} tasks created`);
      if (result.updated) parts.push(`${result.updated} tasks updated`);
      if (result.inboundUpdated) parts.push(`${result.inboundUpdated} assignments updated from Planner`);
      if (result.inboundDeleted) parts.push(`${result.inboundDeleted} tasks deleted in Planner`);
      toast({ 
        title: "Sync completed",
        description: parts.length > 0 ? parts.join(', ') : 'Everything is in sync'
      });
    },
    onError: (error: any) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    }
  });

  const toggleSyncMutation = useMutation({
    mutationFn: async (syncEnabled: boolean) => {
      return await apiRequest(`/api/projects/${projectId}/planner-connection`, {
        method: "PATCH",
        body: JSON.stringify({ syncEnabled })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "planner-sync-status"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update settings", description: error.message, variant: "destructive" });
    }
  });
  
  const toggleAutoAddMutation = useMutation({
    mutationFn: async (autoAddMembers: boolean) => {
      return await apiRequest(`/api/projects/${projectId}/planner-connection`, {
        method: "PATCH",
        body: JSON.stringify({ autoAddMembers })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "planner-sync-status"] });
      toast({ 
        title: "Settings updated",
        description: "Auto-add team members setting has been updated"
      });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update settings", description: error.message, variant: "destructive" });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/projects/${projectId}/planner-connection`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "planner-sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "planner-connection"] });
      toast({ title: "Disconnected from Planner" });
      setShowDisconnectDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to disconnect", description: error.message, variant: "destructive" });
    }
  });

  const resolveConflictMutation = useMutation({
    mutationFn: async ({ syncId, resolution, logId }: { syncId: string; resolution: string; logId?: string }) => {
      return await apiRequest(`/api/projects/${projectId}/planner-sync/resolve-conflict`, {
        method: "POST",
        body: JSON.stringify({ syncId, resolution, logId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "planner-sync-status"] });
      toast({ title: "Conflict resolved" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to resolve conflict", description: error.message, variant: "destructive" });
    }
  });

  const dismissLogMutation = useMutation({
    mutationFn: async (logId: string) => {
      return await apiRequest(`/api/projects/${projectId}/planner-sync/dismiss-log`, {
        method: "POST",
        body: JSON.stringify({ logId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "planner-sync-status"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to dismiss", description: error.message, variant: "destructive" });
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!syncStatus?.connected) {
    return (
      <>
        <Card data-testid="planner-not-connected">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MicrosoftPlannerIcon className="h-5 w-5" />
              Microsoft Planner
            </CardTitle>
            <CardDescription>
              Sync project assignments with Microsoft Planner for collaborative task management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowConnectDialog(true)} data-testid="button-connect-planner">
              <MicrosoftPlannerIcon className="mr-2 h-4 w-4" />
              Connect to Planner
            </Button>
          </CardContent>
        </Card>

        <PlannerConnectionDialog
          open={showConnectDialog}
          onOpenChange={setShowConnectDialog}
          projectId={projectId}
          projectName={projectName}
          clientName={clientName}
          clientTeamId={clientTeamId}
          clientId={clientId}
        />
      </>
    );
  }

  const connection = syncStatus.connection!;
  const lastSyncTime = connection.lastSyncAt 
    ? formatDistanceToNow(new Date(connection.lastSyncAt), { addSuffix: true })
    : "Never";

  const lastInboundTime = connection.lastInboundSyncAt
    ? formatDistanceToNow(new Date(connection.lastInboundSyncAt), { addSuffix: true })
    : null;

  const lastOutboundTime = connection.lastOutboundSyncAt
    ? formatDistanceToNow(new Date(connection.lastOutboundSyncAt), { addSuffix: true })
    : null;

  const getSyncStatusIcon = (status?: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "partial":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'status_update':
        return <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs">Status</Badge>;
      case 'date_update':
        return <Badge variant="outline" className="text-purple-600 border-purple-600 text-xs">Dates</Badge>;
      case 'reassignment':
        return <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">Reassigned</Badge>;
      case 'deletion':
        return <Badge variant="outline" className="text-red-600 border-red-600 text-xs">Deleted</Badge>;
      case 'conflict':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-xs">Conflict</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{action}</Badge>;
    }
  };

  const conflicts = syncStatus.syncs?.filter(s => s.syncStatus === 'conflict') || [];
  const unresolvedLogs = syncStatus.unresolvedLogs || [];

  return (
    <>
      <Card data-testid="planner-connected">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MicrosoftPlannerIcon className="h-5 w-5" />
              <CardTitle>Microsoft Planner</CardTitle>
              <Badge variant="outline" className="text-green-600 border-green-600">
                Connected
              </Badge>
              {connection.webhookActive && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="text-blue-600 border-blue-600 gap-1">
                        <Webhook className="h-3 w-3" />
                        Real-time
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Receiving real-time updates via Microsoft Graph webhooks
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending || !connection.syncEnabled}
                data-testid="button-sync-planner"
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2">Sync Now</span>
              </Button>
            </div>
          </div>
          <CardDescription>
            Connected to "{connection.planTitle}"
            {connection.groupName && ` in ${connection.groupName}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Synced Tasks:</span>
              <span className="ml-2 font-medium">{syncStatus.syncedTasks}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Last Sync:</span>
              {getSyncStatusIcon(connection.lastSyncStatus)}
              <span className="font-medium">{lastSyncTime}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Direction:</span>
              <span className="ml-2 font-medium capitalize">
                {connection.syncDirection?.replace('_', ' ') || 'Bidirectional'}
              </span>
            </div>
            {(syncStatus.conflictCount || 0) > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-yellow-600 font-medium">{syncStatus.conflictCount} conflict(s)</span>
              </div>
            )}
          </div>

          {(lastInboundTime || lastOutboundTime) && (
            <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t">
              {lastOutboundTime && (
                <div className="flex items-center gap-1">
                  <ArrowUpFromLine className="h-3 w-3" />
                  <span>Outbound: {lastOutboundTime}</span>
                </div>
              )}
              {lastInboundTime && (
                <div className="flex items-center gap-1">
                  <ArrowDownToLine className="h-3 w-3" />
                  <span>Inbound: {lastInboundTime}</span>
                </div>
              )}
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-sm font-medium flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                Sync Conflicts
              </h4>
              {conflicts.map(conflict => {
                let conflictInfo: { message?: string; fields?: { field: string; local: string; remote: string }[] } = {};
                try {
                  if (conflict.syncError) {
                    conflictInfo = JSON.parse(conflict.syncError);
                  }
                } catch {
                  conflictInfo = { message: conflict.syncError || '' };
                }

                return (
                  <div key={conflict.id} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{conflict.taskTitle}</span>
                      <div className="flex gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => resolveConflictMutation.mutate({ syncId: conflict.id, resolution: 'keep_local' })}
                                disabled={resolveConflictMutation.isPending}
                              >
                                <ArrowUpFromLine className="h-3 w-3 mr-1" />
                                Keep Local
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Push Constellation data to Planner</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => resolveConflictMutation.mutate({ syncId: conflict.id, resolution: 'keep_remote' })}
                                disabled={resolveConflictMutation.isPending}
                              >
                                <ArrowDownToLine className="h-3 w-3 mr-1" />
                                Keep Planner
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Accept Planner data into Constellation</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => resolveConflictMutation.mutate({ syncId: conflict.id, resolution: 'dismiss' })}
                          disabled={resolveConflictMutation.isPending}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {conflictInfo.fields && conflictInfo.fields.length > 0 ? (
                      <div className="mt-1 space-y-1">
                        {conflictInfo.fields.map((f, idx) => (
                          <div key={idx} className="grid grid-cols-3 gap-2 text-xs border-t border-yellow-200 dark:border-yellow-700 pt-1">
                            <span className="font-medium text-muted-foreground">{f.field}</span>
                            <span className="text-blue-700 dark:text-blue-400" title="Constellation value">Local: {f.local}</span>
                            <span className="text-orange-700 dark:text-orange-400" title="Planner value">Planner: {f.remote}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{conflictInfo.message || 'Concurrent changes detected'}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {unresolvedLogs.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-sm font-medium flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                Items Requiring Review ({unresolvedLogs.length})
              </h4>
              {unresolvedLogs.slice(0, 5).map(log => (
                <div key={log.id} className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {log.direction === 'inbound' ? (
                        <ArrowDownToLine className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ArrowUpFromLine className="h-3 w-3 text-muted-foreground" />
                      )}
                      {getActionBadge(log.action)}
                      <span className="text-xs">{log.details}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => dismissLogMutation.mutate(log.id)}
                      disabled={dismissLogMutation.isPending}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
              {unresolvedLogs.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  + {unresolvedLogs.length - 5} more items
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="sync-enabled"
                  checked={connection.syncEnabled}
                  onCheckedChange={(checked) => toggleSyncMutation.mutate(checked)}
                  disabled={toggleSyncMutation.isPending}
                />
                <Label htmlFor="sync-enabled">
                  Auto-sync enabled
                </Label>
              </div>
              
              {connection.groupId && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-add-members"
                    checked={connection.autoAddMembers || false}
                    onCheckedChange={(checked) => toggleAutoAddMutation.mutate(checked)}
                    disabled={toggleAutoAddMutation.isPending}
                  />
                  <Label htmlFor="auto-add-members" className="text-sm">
                    Auto-add missing team members
                  </Label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActivityLog(!showActivityLog)}
                className="text-xs text-muted-foreground"
              >
                {showActivityLog ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {showActivityLog ? 'Hide' : 'Show'} Activity Log
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const planUrl = `https://tasks.office.com/Home/PlanViews/${connection.planId}`;
                    window.open(planUrl, '_blank');
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open Plan in Planner
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDisconnectDialog(true)}
                  className="text-destructive hover:text-destructive"
                  data-testid="button-disconnect-planner"
                >
                  <Unlink className="h-4 w-4 mr-1" />
                  Disconnect
                </Button>
              </div>
            </div>
          </div>

          {showActivityLog && syncStatus.recentLogs && syncStatus.recentLogs.length > 0 && (
            <div className="space-y-1 pt-2 border-t">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Recent Sync Activity</h4>
              {syncStatus.recentLogs.map(log => (
                <div key={log.id} className="flex items-center gap-2 text-xs py-1">
                  {log.direction === 'inbound' ? (
                    <ArrowDownToLine className="h-3 w-3 text-blue-500 flex-shrink-0" />
                  ) : (
                    <ArrowUpFromLine className="h-3 w-3 text-green-500 flex-shrink-0" />
                  )}
                  {getActionBadge(log.action)}
                  <span className="text-muted-foreground truncate flex-1">{log.details}</span>
                  <span className="text-muted-foreground flex-shrink-0">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </span>
                  {log.resolvedAt && (
                    <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect from Microsoft Planner?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop syncing between this project and Microsoft Planner. 
              Tasks already created in Planner will remain there but won't be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Disconnect"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
