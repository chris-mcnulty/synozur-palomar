import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users, UserPlus, UserMinus, RefreshCw, CheckCircle, AlertCircle, Clock, XCircle
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

interface TeamMember {
  personId: string | null;
  name: string;
  email: string;
  azureUserId: string | null;
  azureDisplayName: string | null;
  mappingMethod: string | null;
  teamMembershipStatus: 'added' | 'not_in_azure_ad' | 'not_in_team' | 'pending';
  isAssigned: boolean;
}

interface TeamMembersResponse {
  members: TeamMember[];
  hasConnection: boolean;
  teamId?: string;
  teamName?: string;
  autoAddMembers?: boolean;
}

interface TeamMembersPanelProps {
  projectId: string;
}

export function TeamMembersPanel({ projectId }: TeamMembersPanelProps) {
  const { toast } = useToast();
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null);

  const { data, isLoading } = useQuery<TeamMembersResponse>({
    queryKey: ['/api/projects', projectId, 'team-members'],
    enabled: !!projectId,
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/projects/${projectId}/team-members/${userId}/add`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({ title: "Member added to Team" });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'team-members'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add member",
        description: error.message || "Could not add member to Team",
        variant: "destructive"
      });
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ personId, azureUserId }: { personId: string | null; azureUserId: string | null }) => {
      const userId = personId || azureUserId;
      if (!userId) throw new Error("No user identifier available");
      return apiRequest(`/api/projects/${projectId}/team-members/${userId}/remove`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({ title: "Member removed from Team" });
      setRemovingMember(null);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'team-members'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove member",
        description: error.message || "Could not remove member from Team",
        variant: "destructive"
      });
      setRemovingMember(null);
    }
  });

  const retryMappingMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/projects/${projectId}/team-members/${userId}/retry-mapping`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({ title: "Azure AD mapping updated" });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'team-members'] });
    },
    onError: (error: any) => {
      toast({
        title: "Mapping failed",
        description: error.message || "Could not find user in Azure AD",
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.hasConnection) {
    return null;
  }

  const members = data.members || [];
  const assignedMembers = members.filter(m => m.isAssigned);
  const unassignedMembers = members.filter(m => !m.isAssigned);
  const addedCount = members.filter(m => m.teamMembershipStatus === 'added').length;
  const pendingCount = members.filter(m => m.isAssigned && m.teamMembershipStatus !== 'added').length;

  const statusConfig = {
    added: { icon: CheckCircle, label: "In Team", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    not_in_team: { icon: XCircle, label: "Not in Team", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    not_in_azure_ad: { icon: AlertCircle, label: "Not in Azure AD", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    pending: { icon: Clock, label: "Pending", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  };

  const renderMemberRow = (member: TeamMember) => {
    const config = statusConfig[member.teamMembershipStatus];
    const StatusIcon = config.icon;
    const isAdding = addMemberMutation.isPending && addMemberMutation.variables === member.personId;
    const isRetrying = retryMappingMutation.isPending && retryMappingMutation.variables === member.personId;
    const memberKey = member.personId || member.azureUserId || member.email;

    return (
      <div
        key={memberKey}
        className="flex items-center justify-between p-3 rounded-lg border bg-card"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
            {member.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{member.name}</p>
              {!member.isAssigned && (
                <Badge variant="outline" className="text-xs">Not assigned</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className={config.className}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>

          {member.teamMembershipStatus === 'not_in_team' && member.personId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => addMemberMutation.mutate(member.personId!)}
              disabled={isAdding}
            >
              {isAdding ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <UserPlus className="h-3 w-3" />
              )}
              <span className="ml-1">Add</span>
            </Button>
          )}

          {member.teamMembershipStatus === 'not_in_azure_ad' && member.personId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => retryMappingMutation.mutate(member.personId!)}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              <span className="ml-1">Retry</span>
            </Button>
          )}

          {member.teamMembershipStatus === 'added' && (member.personId || member.azureUserId) && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setRemovingMember(member)}
            >
              <UserMinus className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Team Members
            </CardTitle>
            <CardDescription>
              {data.teamName ? `${data.teamName} — ` : ""}
              {addedCount} in Team{pendingCount > 0 ? `, ${pendingCount} pending` : ""}
              {data.autoAddMembers && (
                <Badge variant="outline" className="ml-2 text-xs">Auto-add enabled</Badge>
              )}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'team-members'] })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members assigned to this project yet.</p>
          ) : (
            <div className="space-y-2">
              {assignedMembers.map(renderMemberRow)}
              {unassignedMembers.length > 0 && (
                <>
                  {assignedMembers.length > 0 && (
                    <div className="border-t pt-2 mt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        In Team but not assigned to this project
                      </p>
                    </div>
                  )}
                  {unassignedMembers.map(renderMemberRow)}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!removingMember} onOpenChange={() => setRemovingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{removingMember?.name}</strong> from the Microsoft Team?
              They will lose access to Team channels and files.
              {removingMember && !removingMember.isAssigned && (
                <span className="block mt-2 text-muted-foreground">
                  This person is no longer assigned to this project.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removingMember) {
                  removeMemberMutation.mutate({
                    personId: removingMember.personId,
                    azureUserId: removingMember.azureUserId,
                  });
                }
              }}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
