import * as cron from 'node-cron';
import { storage } from '../storage.js';

interface PlannerSyncResult {
  projectId: string;
  projectName: string;
  created: number;
  updated: number;
  inboundUpdated: number;
  inboundDeleted: number;
  conflicts: number;
  errors: string[];
}

interface PlannerSyncJobResult {
  projectsSynced: number;
  projectsSkipped: number;
  projectsFailed: number;
  totalCreated: number;
  totalUpdated: number;
  totalInboundUpdated: number;
  totalInboundDeleted: number;
  totalConflicts: number;
  details: PlannerSyncResult[];
}

let scheduledTask: cron.ScheduledTask | null = null;

async function syncProjectToPlanner(
  projectId: string,
  connection: any
): Promise<PlannerSyncResult> {
  const { plannerService } = await import('./planner-service.js');
  
  const project = await storage.getProject(projectId);
  const projectName = project?.name || projectId;
  
  const result: PlannerSyncResult = {
    projectId,
    projectName,
    created: 0,
    updated: 0,
    inboundUpdated: 0,
    inboundDeleted: 0,
    conflicts: 0,
    errors: []
  };

  try {
    const allocations = await storage.getProjectAllocations(projectId);
    const existingSyncs = await storage.getPlannerTaskSyncsByConnection(connection.id);
    const buckets = await plannerService.listBuckets(connection.planId);

    // Pre-create Planner buckets for all project stages
    const projectEpicsList = await storage.getProjectEpics(projectId);
    for (const epic of projectEpicsList) {
      const stages = await storage.getProjectStages(epic.id);
      for (const stage of stages) {
        try {
          await plannerService.getOrCreateBucket(connection.planId, stage.name);
        } catch (bucketErr: any) {
          console.warn('[PLANNER-SYNC] Failed to pre-create bucket for stage:', stage.name, bucketErr.message);
        }
      }
    }

    for (const allocation of allocations) {
      try {
        const syncRecord = existingSyncs.find(s => s.allocationId === allocation.id);

        let taskTitle = allocation.taskDescription || '';
        if (!taskTitle && allocation.workstream) {
          taskTitle = typeof allocation.workstream === 'string' ? allocation.workstream : allocation.workstream.name;
        }
        if (!taskTitle) {
          taskTitle = `Week ${allocation.weekNumber} Task`;
        }

        let stageName = 'Unassigned';
        if (allocation.stage?.name) {
          stageName = allocation.stage.name;
        } else if (allocation.projectStageId) {
          const stage = await storage.getProjectStage(allocation.projectStageId);
          if (stage?.name) {
            stageName = stage.name;
          }
        }
        
        const bucket = await plannerService.getOrCreateBucket(connection.planId, stageName);

        let assigneeIds: string[] = [];
        if (allocation.person?.email) {
          let azureMapping = await storage.getUserAzureMappingByEmail(allocation.person.email);
          if (!azureMapping && allocation.personId) {
            azureMapping = await storage.getUserAzureMapping(allocation.personId);
          }
          if (azureMapping) {
            assigneeIds = [azureMapping.azureUserId];
          } else {
            try {
              const azureUser = await plannerService.findUserByEmail(allocation.person.email);
              if (azureUser && allocation.personId) {
                await storage.createUserAzureMapping({
                  userId: allocation.personId,
                  azureUserId: azureUser.id,
                  azureUserPrincipalName: azureUser.userPrincipalName,
                  azureDisplayName: azureUser.displayName,
                  mappingMethod: 'auto_discovered',
                  verifiedAt: new Date()
                });
                assigneeIds = [azureUser.id];

                if (connection.autoAddMembers && connection.groupId) {
                  const addResult = await plannerService.addUserToGroup(connection.groupId, azureUser.id);
                  if (!addResult.success) {
                    result.errors.push(`Could not add ${azureUser.displayName} to Team: ${addResult.error}`);
                  }
                }
              }
            } catch (discoverErr: any) {
              console.warn('[PLANNER-SYNC] Auto-discovery error:', discoverErr.message);
            }
          }
        } else if (allocation.personId) {
          const azureMapping = await storage.getUserAzureMapping(allocation.personId);
          if (azureMapping) {
            assigneeIds = [azureMapping.azureUserId];
          }
        }

        const baseUrl = process.env.APP_PUBLIC_URL || 'https://constellation.synozur.com';
        const assignmentLink = `${baseUrl}/projects/${projectId}?tab=delivery&assignmentId=${allocation.id}`;
        const originalNotes = allocation.notes || allocation.taskDescription || '';
        const hoursStr = allocation.hours ? `HOURS: ${allocation.hours}` : '';
        const notesParts = [
          `View in Constellation: ${assignmentLink}`,
          hoursStr,
          originalNotes
        ].filter(Boolean);
        const taskNotes = notesParts.join('\n\n').trim();

        let percentComplete = 0;
        if (allocation.status === 'completed') {
          percentComplete = 100;
        } else if (allocation.status === 'in_progress') {
          percentComplete = 50;
        }

        if (syncRecord) {
          const reviewStates = ['pending_inbound', 'conflict'];
          if (reviewStates.includes(syncRecord.syncStatus)) {
            console.log(`[PLANNER-SYNC] Skipping outbound for allocation ${allocation.id} - sync status is ${syncRecord.syncStatus} (awaiting review)`);
            continue;
          }

          let updateStartDateTime: string | null = allocation.plannedStartDate || null;
          let updateDueDateTime: string | null = allocation.plannedEndDate || null;

          if (updateStartDateTime && updateDueDateTime) {
            const startDate = new Date(updateStartDateTime);
            const endDate = new Date(updateDueDateTime);
            if (endDate < startDate) {
              [updateStartDateTime, updateDueDateTime] = [updateDueDateTime, updateStartDateTime];
            }
          }

          const task = await plannerService.getTask(syncRecord.taskId);
          if (task) {
            await plannerService.updateTask(syncRecord.taskId, task['@odata.etag'] || '', {
              title: taskTitle,
              bucketId: bucket.id,
              startDateTime: updateStartDateTime,
              dueDateTime: updateDueDateTime,
              percentComplete,
              assigneeIds
            });

            try {
              const taskDetails = await plannerService.getTaskDetails(syncRecord.taskId);
              if (taskDetails) {
                await plannerService.updateTaskDetails(syncRecord.taskId, taskDetails['@odata.etag'] || '', taskNotes);
              }
            } catch (notesErr: any) {
              console.warn('[PLANNER-SYNC] Failed to update task notes:', notesErr.message);
            }

            await storage.updatePlannerTaskSync(syncRecord.id, {
              taskTitle,
              bucketId: bucket.id,
              bucketName: stageName,
              lastSyncedAt: new Date(),
              syncStatus: 'synced',
              localVersion: 1,
              remoteEtag: task['@odata.etag']
            });
            result.updated++;
          } else {
            if (syncRecord.syncError === 'Task deleted in Planner') {
              console.log(`[PLANNER-SYNC] Task ${syncRecord.taskId} was deleted in Planner and flagged for review, skipping recreation`);
              continue;
            }

            console.warn(`[PLANNER-SYNC] Task ${syncRecord.taskId} not found in Planner, recreating...`);
            
            const newTask = await plannerService.createTask({
              planId: connection.planId,
              title: taskTitle,
              bucketId: bucket.id,
              startDateTime: updateStartDateTime || undefined,
              dueDateTime: updateDueDateTime || undefined,
              percentComplete,
              assigneeIds
            });

            try {
              const taskDetails = await plannerService.getTaskDetails(newTask.id);
              if (taskDetails) {
                await plannerService.updateTaskDetails(newTask.id, taskDetails['@odata.etag'] || '', taskNotes);
              }
            } catch (notesErr: any) {
              console.warn('[PLANNER-SYNC] Failed to set task notes:', notesErr.message);
            }

            await storage.updatePlannerTaskSync(syncRecord.id, {
              taskId: newTask.id,
              taskTitle,
              bucketId: bucket.id,
              bucketName: stageName,
              lastSyncedAt: new Date(),
              syncStatus: 'synced',
              localVersion: syncRecord.localVersion + 1,
              remoteEtag: newTask['@odata.etag']
            });
            result.created++;
          }
        } else {
          let startDateTime: string | null = allocation.plannedStartDate || null;
          let dueDateTime: string | null = allocation.plannedEndDate || null;

          if (startDateTime && dueDateTime) {
            const startDate = new Date(startDateTime);
            const endDate = new Date(dueDateTime);
            if (endDate < startDate) {
              [startDateTime, dueDateTime] = [dueDateTime, startDateTime];
            }
          }

          const newTask = await plannerService.createTask({
            planId: connection.planId,
            title: taskTitle,
            bucketId: bucket.id,
            startDateTime: startDateTime || undefined,
            dueDateTime: dueDateTime || undefined,
            percentComplete,
            assigneeIds
          });

          try {
            const taskDetails = await plannerService.getTaskDetails(newTask.id);
            if (taskDetails) {
              await plannerService.updateTaskDetails(newTask.id, taskDetails['@odata.etag'] || '', taskNotes);
            }
          } catch (notesErr: any) {
            console.warn('[PLANNER-SYNC] Failed to set task notes:', notesErr.message);
          }

          await storage.createPlannerTaskSync({
            connectionId: connection.id,
            allocationId: allocation.id,
            taskId: newTask.id,
            taskTitle,
            bucketId: bucket.id,
            bucketName: stageName,
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
            localVersion: 1,
            remoteEtag: newTask['@odata.etag']
          });
          result.created++;
        }
      } catch (allocErr: any) {
        // Build a friendly error message with context for manual debugging
        const personName = allocation.person?.name || allocation.personId || 'Unknown person';
        const taskDesc = allocation.taskDescription || allocation.notes || 'No description';
        const dates = `${allocation.plannedStartDate || 'no start'} to ${allocation.plannedEndDate || 'no end'}`;
        const friendlyError = `Assignment for "${personName}" (${taskDesc.substring(0, 50)}${taskDesc.length > 50 ? '...' : ''}) with dates ${dates}: ${allocErr.message}`;
        result.errors.push(friendlyError);
        console.error(`[PLANNER-SYNC] ${friendlyError} (Allocation ID: ${allocation.id})`);
      }
    }

    await storage.updateProjectPlannerConnection(connection.id, {
      lastSyncAt: new Date(),
      lastOutboundSyncAt: new Date(),
      lastSyncStatus: result.errors.length > 0 ? 'partial' : 'success',
      lastSyncError: result.errors.length > 0 ? result.errors.join('; ') : null
    });

  } catch (err: any) {
    result.errors.push(err.message);
    await storage.updateProjectPlannerConnection(connection.id, {
      lastSyncAt: new Date(),
      lastSyncStatus: 'error',
      lastSyncError: err.message
    });
  }

  return result;
}

export async function syncFromPlanner(
  projectId: string,
  connection: any
): Promise<PlannerSyncResult> {
  const { plannerService } = await import('./planner-service.js');

  const project = await storage.getProject(projectId);
  const projectName = project?.name || projectId;

  const result: PlannerSyncResult = {
    projectId,
    projectName,
    created: 0,
    updated: 0,
    inboundUpdated: 0,
    inboundDeleted: 0,
    conflicts: 0,
    errors: []
  };

  try {
    const remoteTasks = await plannerService.listTasks(connection.planId);
    const existingSyncs = await storage.getPlannerTaskSyncsByConnection(connection.id);

    const remoteTaskMap = new Map(remoteTasks.map(t => [t.id, t]));

    for (const syncRecord of existingSyncs) {
      if (!syncRecord.allocationId) continue;

      const remoteTask = remoteTaskMap.get(syncRecord.taskId);

      if (!remoteTask) {
        if (syncRecord.syncStatus === 'pending_inbound' || syncRecord.syncStatus === 'error') {
          continue;
        }

        await storage.createPlannerSyncLog({
          connectionId: connection.id,
          direction: 'inbound',
          action: 'deletion',
          allocationId: syncRecord.allocationId,
          taskId: syncRecord.taskId,
          details: `Task "${syncRecord.taskTitle}" was deleted in Planner. Allocation flagged for PM review.`,
        });

        await storage.updatePlannerTaskSync(syncRecord.id, {
          syncStatus: 'pending_inbound',
          syncError: 'Task deleted in Planner',
        });

        result.inboundDeleted++;

        try {
          await notifyPMOfPlannerChange(projectId, 'deletion', syncRecord.taskTitle || 'Unknown task', null);
        } catch (notifyErr: any) {
          console.warn('[PLANNER-INBOUND] Failed to notify PM of deletion:', notifyErr.message);
        }

        continue;
      }

      if (syncRecord.syncStatus === 'conflict') continue;

      const remoteEtag = remoteTask['@odata.etag'] || '';
      const etagChanged = remoteEtag && remoteEtag !== syncRecord.remoteEtag;

      if (!etagChanged) continue;

      const localVersionAdvanced = syncRecord.localVersion > 1 && syncRecord.syncStatus === 'pending_outbound';
      if (localVersionAdvanced) {
        const allocation = await storage.getProjectAllocation(syncRecord.allocationId);
        const conflictFields: { field: string; local: string; remote: string }[] = [];

        if (allocation) {
          const remoteStatus = remoteTask.percentComplete === 100 ? 'completed' : (remoteTask.percentComplete === 50 ? 'in_progress' : 'not_started');
          if (allocation.status !== remoteStatus) {
            conflictFields.push({ field: 'Status', local: allocation.status || 'not_started', remote: remoteStatus });
          }
          if (remoteTask.startDateTime) {
            const remoteStart = remoteTask.startDateTime.split('T')[0];
            const localStart = allocation.plannedStartDate?.split('T')[0] || '';
            if (localStart !== remoteStart) {
              conflictFields.push({ field: 'Start Date', local: localStart || '(none)', remote: remoteStart });
            }
          }
          if (remoteTask.dueDateTime) {
            const remoteDue = remoteTask.dueDateTime.split('T')[0];
            const localEnd = allocation.plannedEndDate?.split('T')[0] || '';
            if (localEnd !== remoteDue) {
              conflictFields.push({ field: 'Due Date', local: localEnd || '(none)', remote: remoteDue });
            }
          }
        }

        const conflictDetail = JSON.stringify({
          message: 'Both local and remote changes detected since last sync',
          fields: conflictFields,
        });

        await storage.updatePlannerTaskSync(syncRecord.id, {
          syncStatus: 'conflict',
          syncError: conflictDetail,
        });

        await storage.createPlannerSyncLog({
          connectionId: connection.id,
          direction: 'inbound',
          action: 'conflict',
          allocationId: syncRecord.allocationId,
          taskId: syncRecord.taskId,
          details: `Conflict detected for "${syncRecord.taskTitle}". Both Constellation and Planner have changes.${conflictFields.length > 0 ? ' Fields: ' + conflictFields.map(f => f.field).join(', ') : ''}`,
        });

        result.conflicts++;
        continue;
      }

      try {
        const allocation = await storage.getProjectAllocation(syncRecord.allocationId);
        if (!allocation) continue;

        let changesMade = false;
        const updates: any = {};

        if (remoteTask.percentComplete === 100 && allocation.status !== 'completed') {
          updates.status = 'completed';
          changesMade = true;
          await storage.createPlannerSyncLog({
            connectionId: connection.id,
            direction: 'inbound',
            action: 'status_update',
            allocationId: syncRecord.allocationId,
            taskId: syncRecord.taskId,
            details: `Task "${syncRecord.taskTitle}" marked complete in Planner. Allocation status updated to completed.`,
          });
        } else if (remoteTask.percentComplete === 50 && allocation.status !== 'in_progress') {
          updates.status = 'in_progress';
          changesMade = true;
          await storage.createPlannerSyncLog({
            connectionId: connection.id,
            direction: 'inbound',
            action: 'status_update',
            allocationId: syncRecord.allocationId,
            taskId: syncRecord.taskId,
            details: `Task "${syncRecord.taskTitle}" marked in-progress in Planner. Allocation status updated.`,
          });
        } else if (remoteTask.percentComplete === 0 && allocation.status === 'completed') {
          updates.status = 'planned';
          changesMade = true;
          await storage.createPlannerSyncLog({
            connectionId: connection.id,
            direction: 'inbound',
            action: 'status_update',
            allocationId: syncRecord.allocationId,
            taskId: syncRecord.taskId,
            details: `Task "${syncRecord.taskTitle}" reopened in Planner. Allocation status reset to planned.`,
          });
        }

        if (remoteTask.startDateTime) {
          const remoteStart = remoteTask.startDateTime.split('T')[0];
          const localStart = allocation.plannedStartDate?.split('T')[0];
          if (remoteStart !== localStart) {
            updates.plannedStartDate = remoteStart;
            changesMade = true;
          }
        } else if (allocation.plannedStartDate) {
          updates.plannedStartDate = null;
          changesMade = true;
        }
        if (remoteTask.dueDateTime) {
          const remoteDue = remoteTask.dueDateTime.split('T')[0];
          const localEnd = allocation.plannedEndDate?.split('T')[0];
          if (remoteDue !== localEnd) {
            updates.plannedEndDate = remoteDue;
            changesMade = true;
          }
        } else if (allocation.plannedEndDate) {
          updates.plannedEndDate = null;
          changesMade = true;
        }

        if (updates.plannedStartDate !== undefined || updates.plannedEndDate !== undefined) {
          await storage.createPlannerSyncLog({
            connectionId: connection.id,
            direction: 'inbound',
            action: 'date_update',
            allocationId: syncRecord.allocationId,
            taskId: syncRecord.taskId,
            details: `Task "${syncRecord.taskTitle}" dates changed in Planner.`,
          });
        }

        const remoteAssigneeIds = remoteTask.assignments ? Object.keys(remoteTask.assignments) : [];
        let currentAssigneeAzureId: string | null = null;
        if (allocation.personId) {
          const azureMapping = await storage.getUserAzureMapping(allocation.personId);
          if (azureMapping) {
            currentAssigneeAzureId = azureMapping.azureUserId;
          }
        }

        const wasReassigned = currentAssigneeAzureId &&
          remoteAssigneeIds.length > 0 &&
          !remoteAssigneeIds.includes(currentAssigneeAzureId);

        if (wasReassigned) {
          await storage.createPlannerSyncLog({
            connectionId: connection.id,
            direction: 'inbound',
            action: 'reassignment',
            allocationId: syncRecord.allocationId,
            taskId: syncRecord.taskId,
            details: `Task "${syncRecord.taskTitle}" was reassigned in Planner. PM review required.`,
          });

          try {
            const newAssigneeId = remoteAssigneeIds[0];
            const newAssignee = await plannerService.findUserById(newAssigneeId);
            await notifyPMOfPlannerChange(
              projectId,
              'reassignment',
              syncRecord.taskTitle || 'Unknown task',
              newAssignee?.displayName || newAssigneeId
            );
          } catch (notifyErr: any) {
            console.warn('[PLANNER-INBOUND] Failed to notify PM of reassignment:', notifyErr.message);
          }
        }

        if (changesMade) {
          await storage.updateProjectAllocation(syncRecord.allocationId, updates);
          result.inboundUpdated++;
        }

        await storage.updatePlannerTaskSync(syncRecord.id, {
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          remoteEtag: remoteEtag,
          taskTitle: remoteTask.title,
        });

      } catch (syncErr: any) {
        result.errors.push(`Inbound sync for task ${syncRecord.taskId}: ${syncErr.message}`);
        console.error(`[PLANNER-INBOUND] Error syncing task ${syncRecord.taskId}:`, syncErr.message);
      }
    }

    await storage.updateProjectPlannerConnection(connection.id, {
      lastInboundSyncAt: new Date(),
    });

  } catch (err: any) {
    result.errors.push(`Inbound sync error: ${err.message}`);
    console.error('[PLANNER-INBOUND] Error:', err.message);
  }

  return result;
}

async function notifyPMOfPlannerChange(
  projectId: string,
  changeType: 'reassignment' | 'deletion',
  taskTitle: string,
  newAssignee: string | null
): Promise<void> {
  try {
    const project = await storage.getProject(projectId);
    if (!project) return;

    let pmUser: any = null;
    if (project.pm) {
      pmUser = await storage.getUser(project.pm);
    }
    if (!pmUser?.email) return;

    const { emailService } = await import('./email-notification.js');
    const APP_URL = process.env.APP_PUBLIC_URL || 'https://constellation.synozur.com';

    const pmName = `${pmUser.firstName || ''} ${pmUser.lastName || ''}`.trim() || pmUser.email;
    const projectUrl = `${APP_URL}/projects/${projectId}?tab=delivery`;

    let subject: string;
    let body: string;

    if (changeType === 'reassignment') {
      subject = `Planner Task Reassigned: ${taskTitle}`;
      body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Task Reassigned in Planner</h2>
          <p>Hi ${pmName},</p>
          <p>The following task was reassigned in Microsoft Planner and may need your review:</p>
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Task:</strong> ${taskTitle}</p>
            <p><strong>Project:</strong> ${project.name}</p>
            ${newAssignee ? `<p><strong>New Assignee:</strong> ${newAssignee}</p>` : ''}
          </div>
          <p>The corresponding assignment in Constellation has not been changed automatically. Please review and update if needed.</p>
          <p><a href="${projectUrl}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Review in Constellation</a></p>
        </div>
      `;
    } else {
      subject = `Planner Task Deleted: ${taskTitle}`;
      body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Task Deleted in Planner</h2>
          <p>Hi ${pmName},</p>
          <p>The following task was deleted in Microsoft Planner:</p>
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Task:</strong> ${taskTitle}</p>
            <p><strong>Project:</strong> ${project.name}</p>
          </div>
          <p>The corresponding assignment in Constellation has been flagged for your review. It has not been automatically deleted.</p>
          <p><a href="${projectUrl}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Review in Constellation</a></p>
        </div>
      `;
    }

    await emailService.sendEmail({
      to: { email: pmUser.email, name: pmName },
      subject,
      body
    });

    console.log(`[PLANNER-INBOUND] PM notified of ${changeType} for task "${taskTitle}" in project ${project.name}`);
  } catch (err: any) {
    console.error(`[PLANNER-INBOUND] Failed to notify PM:`, err.message);
  }
}

export async function runPlannerSyncJob(
  triggeredBy: 'scheduled' | 'manual' | 'catchup' = 'scheduled',
  triggeredByUserId?: string,
  specificProjectId?: string,
  tenantId?: string
): Promise<PlannerSyncJobResult> {
  console.log('[PLANNER-SYNC] Starting Planner sync job...');

  // Determine tenant ID: use provided, or get from specific project, or null for system-wide scheduled runs
  let jobTenantId: string | null = tenantId || null;
  
  if (specificProjectId && !jobTenantId) {
    const project = await storage.getProject(specificProjectId);
    jobTenantId = project?.tenantId || null;
  }

  const jobRun = await storage.createScheduledJobRun({
    tenantId: jobTenantId,
    jobType: 'planner_sync',
    status: 'running',
    triggeredBy,
    triggeredByUserId: triggeredByUserId || null,
  });

  const result: PlannerSyncJobResult = {
    projectsSynced: 0,
    projectsSkipped: 0,
    projectsFailed: 0,
    totalCreated: 0,
    totalUpdated: 0,
    totalInboundUpdated: 0,
    totalInboundDeleted: 0,
    totalConflicts: 0,
    details: []
  };

  try {
    let connections: any[];
    
    if (specificProjectId) {
      const conn = await storage.getProjectPlannerConnection(specificProjectId);
      connections = conn ? [conn] : [];
    } else {
      connections = await storage.getAllPlannerConnectionsWithSyncEnabled();
    }

    console.log(`[PLANNER-SYNC] Found ${connections.length} connection(s) to sync`);

    for (const connection of connections) {
      if (!connection.syncEnabled) {
        console.log(`[PLANNER-SYNC] Skipping project ${connection.projectId} - sync disabled`);
        result.projectsSkipped++;
        continue;
      }

      try {
        console.log(`[PLANNER-SYNC] Syncing project ${connection.projectId}...`);

        const syncDirection = connection.syncDirection || 'bidirectional';

        let outboundResult: PlannerSyncResult = {
          projectId: connection.projectId,
          projectName: connection.projectId,
          created: 0, updated: 0, inboundUpdated: 0, inboundDeleted: 0, conflicts: 0, errors: []
        };
        let inboundResult: PlannerSyncResult = {
          projectId: connection.projectId,
          projectName: connection.projectId,
          created: 0, updated: 0, inboundUpdated: 0, inboundDeleted: 0, conflicts: 0, errors: []
        };

        if (syncDirection === 'bidirectional' || syncDirection === 'inbound_only') {
          inboundResult = await syncFromPlanner(connection.projectId, connection);
        }

        if (syncDirection === 'bidirectional' || syncDirection === 'outbound_only') {
          outboundResult = await syncProjectToPlanner(connection.projectId, connection);
        }

        const combinedResult: PlannerSyncResult = {
          projectId: connection.projectId,
          projectName: outboundResult.projectName || inboundResult.projectName,
          created: outboundResult.created,
          updated: outboundResult.updated,
          inboundUpdated: inboundResult.inboundUpdated,
          inboundDeleted: inboundResult.inboundDeleted,
          conflicts: inboundResult.conflicts,
          errors: [...outboundResult.errors, ...inboundResult.errors]
        };

        result.details.push(combinedResult);

        if (combinedResult.errors.length > 0 && combinedResult.created === 0 && combinedResult.updated === 0 && combinedResult.inboundUpdated === 0) {
          result.projectsFailed++;
        } else {
          result.projectsSynced++;
        }

        result.totalCreated += combinedResult.created;
        result.totalUpdated += combinedResult.updated;
        result.totalInboundUpdated += combinedResult.inboundUpdated;
        result.totalInboundDeleted += combinedResult.inboundDeleted;
        result.totalConflicts += combinedResult.conflicts;

        console.log(`[PLANNER-SYNC] Project ${combinedResult.projectName}: ${combinedResult.created} created, ${combinedResult.updated} updated, ${combinedResult.inboundUpdated} inbound, ${combinedResult.conflicts} conflicts, ${combinedResult.errors.length} errors`);
      } catch (projErr: any) {
        console.error(`[PLANNER-SYNC] Failed to sync project ${connection.projectId}:`, projErr);
        result.projectsFailed++;
        result.details.push({
          projectId: connection.projectId,
          projectName: connection.projectId,
          created: 0,
          updated: 0,
          inboundUpdated: 0,
          inboundDeleted: 0,
          conflicts: 0,
          errors: [projErr.message]
        });
      }
    }

    const allErrors = result.details.flatMap(d => d.errors);
    const status = result.projectsFailed > 0 && result.projectsSynced === 0 ? 'failed' : 
                   allErrors.length > 0 ? 'completed' : 'completed';

    await storage.updateScheduledJobRun(jobRun.id, {
      status,
      completedAt: new Date(),
      resultSummary: {
        projectsSynced: result.projectsSynced,
        projectsSkipped: result.projectsSkipped,
        projectsFailed: result.projectsFailed,
        totalCreated: result.totalCreated,
        totalUpdated: result.totalUpdated,
        totalInboundUpdated: result.totalInboundUpdated,
        totalInboundDeleted: result.totalInboundDeleted,
        totalConflicts: result.totalConflicts
      },
      errorMessage: allErrors.length > 0 ? allErrors.slice(0, 5).join('; ') : null
    });

    console.log(`[PLANNER-SYNC] Job completed: ${result.projectsSynced} synced, ${result.projectsSkipped} skipped, ${result.projectsFailed} failed`);
    return result;

  } catch (err: any) {
    console.error('[PLANNER-SYNC] Job failed:', err);
    await storage.updateScheduledJobRun(jobRun.id, {
      status: 'failed',
      completedAt: new Date(),
      errorMessage: err.message
    });
    throw err;
  }
}

async function syncSupportTicketsFromPlanner(): Promise<{ ticketsClosed: number; errors: string[] }> {
  const result = { ticketsClosed: 0, errors: [] as string[] };
  
  try {
    const tenantsWithPlanner = await storage.getTenantsWithSupportPlannerEnabled();
    if (tenantsWithPlanner.length === 0) return result;

    const { plannerService } = await import('./planner-service.js');
    if (!plannerService.isAppConfigured()) return result;

    for (const tenant of tenantsWithPlanner) {
      try {
        if (!tenant.supportPlannerPlanId) continue;
        
        const openSyncs = await storage.getOpenSupportTicketSyncsByTenant(tenant.id);
        if (openSyncs.length === 0) continue;

        console.log(`[SUPPORT-PLANNER-SYNC] Checking ${openSyncs.length} open tickets for tenant ${tenant.name}`);

        for (const sync of openSyncs) {
          try {
            const task = await plannerService.getTaskWithDetails(sync.taskId);
            if (!task) {
              await storage.updateSupportTicketPlannerSync(sync.id, { syncStatus: 'error', syncError: 'Task not found in Planner' });
              continue;
            }

            if (task.percentComplete === 100 && sync.ticketStatus !== 'resolved') {
              const ticket = await storage.getSupportTicketById(sync.ticketId);
              if (ticket && ticket.status !== 'resolved') {
                await storage.updateSupportTicket(ticket.id, {
                  status: 'resolved',
                  resolvedAt: new Date(),
                  resolvedBy: null,
                } as any);
                await storage.updateSupportTicketPlannerSync(sync.id, {
                  syncStatus: 'synced',
                  remoteEtag: task['@odata.etag'] || null,
                });

                // Send closure email to requester
                try {
                  const requester = await storage.getUser(ticket.userId);
                  if (requester?.email) {
                    const { emailService } = await import('./email-notification.js');
                    const APP_URL = process.env.APP_PUBLIC_URL || 'https://constellation.synozur.com';
                    const branding = { companyName: tenant.name, emailHeaderUrl: tenant.emailHeaderUrl };
                    await emailService.notifySupportTicketClosed(
                      { email: requester.email, name: `${requester.firstName || ''} ${requester.lastName || ''}`.trim() || requester.email },
                      ticket.ticketNumber,
                      ticket.subject,
                      'Resolved via Microsoft Planner',
                      branding,
                      `${APP_URL}/support`
                    );
                  }
                } catch (emailErr) {
                  console.error('[SUPPORT-PLANNER-SYNC] Failed to send closure email:', emailErr);
                }

                result.ticketsClosed++;
                console.log(`[SUPPORT-PLANNER-SYNC] Ticket #${ticket.ticketNumber} closed via Planner task completion`);
              }
            }

            // Update etag for future conflict detection
            if (task['@odata.etag'] && task['@odata.etag'] !== sync.remoteEtag) {
              await storage.updateSupportTicketPlannerSync(sync.id, { remoteEtag: task['@odata.etag'] });
            }
          } catch (taskErr: any) {
            result.errors.push(`Ticket sync ${sync.id}: ${taskErr.message}`);
            console.error(`[SUPPORT-PLANNER-SYNC] Error checking task ${sync.taskId}:`, taskErr.message);
          }
        }
      } catch (tenantErr: any) {
        result.errors.push(`Tenant ${tenant.name}: ${tenantErr.message}`);
        console.error(`[SUPPORT-PLANNER-SYNC] Error syncing tenant ${tenant.name}:`, tenantErr.message);
      }
    }
  } catch (err: any) {
    result.errors.push(err.message);
    console.error('[SUPPORT-PLANNER-SYNC] Top-level error:', err.message);
  }

  if (result.ticketsClosed > 0 || result.errors.length > 0) {
    console.log(`[SUPPORT-PLANNER-SYNC] Complete: ${result.ticketsClosed} tickets closed, ${result.errors.length} errors`);
  }
  return result;
}

let webhookRenewalTask: cron.ScheduledTask | null = null;

async function renewWebhookSubscriptions(): Promise<void> {
  try {
    const activeSubscriptions = await storage.getAllActivePlannerWebhookSubscriptions();
    if (activeSubscriptions.length === 0) return;

    const { plannerService } = await import('./planner-service.js');
    const now = new Date();
    const renewalThreshold = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    for (const sub of activeSubscriptions) {
      if (sub.expiresAt <= renewalThreshold) {
        try {
          console.log(`[PLANNER-WEBHOOK] Renewing subscription ${sub.subscriptionId}...`);
          const newExpiry = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
          await plannerService.renewWebhookSubscription(sub.subscriptionId, newExpiry);
          await storage.updatePlannerWebhookSubscription(sub.id, {
            expiresAt: newExpiry,
            renewalFailures: 0,
          });
          console.log(`[PLANNER-WEBHOOK] Subscription ${sub.subscriptionId} renewed until ${newExpiry.toISOString()}`);
        } catch (renewErr: any) {
          const failures = (sub.renewalFailures || 0) + 1;
          console.error(`[PLANNER-WEBHOOK] Failed to renew subscription ${sub.subscriptionId} (attempt ${failures}):`, renewErr.message);
          await storage.updatePlannerWebhookSubscription(sub.id, {
            renewalFailures: failures,
            status: failures >= 3 ? 'expired' : 'active',
          });

          if (failures >= 3) {
            await storage.updateProjectPlannerConnection(sub.connectionId, { webhookActive: false });
            console.warn(`[PLANNER-WEBHOOK] Subscription ${sub.subscriptionId} marked expired after ${failures} failures. Falling back to polling.`);
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[PLANNER-WEBHOOK] Error in renewal job:', err.message);
  }
}

export async function createWebhookForConnection(connectionId: string, planId: string): Promise<boolean> {
  try {
    const { plannerService } = await import('./planner-service.js');
    if (!plannerService.isAppConfigured()) return false;

    const APP_URL = process.env.APP_PUBLIC_URL || process.env.REPLIT_DEV_DOMAIN;
    if (!APP_URL) {
      console.warn('[PLANNER-WEBHOOK] No APP_PUBLIC_URL configured, skipping webhook creation');
      return false;
    }

    const notificationUrl = `${APP_URL.startsWith('http') ? APP_URL : 'https://' + APP_URL}/api/webhooks/planner`;
    const clientState = `planner_${connectionId}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    const subscription = await plannerService.createWebhookSubscription(
      `/planner/plans/${planId}/tasks`,
      notificationUrl,
      clientState,
      expiresAt
    );

    await storage.createPlannerWebhookSubscription({
      connectionId,
      subscriptionId: subscription.id,
      resource: `/planner/plans/${planId}/tasks`,
      expiresAt: new Date(subscription.expirationDateTime),
      clientState,
      status: 'active',
      renewalFailures: 0,
    });

    await storage.updateProjectPlannerConnection(connectionId, { webhookActive: true });
    console.log(`[PLANNER-WEBHOOK] Webhook subscription created for connection ${connectionId}`);
    return true;
  } catch (err: any) {
    console.warn(`[PLANNER-WEBHOOK] Failed to create webhook subscription: ${err.message}. Falling back to polling.`);
    return false;
  }
}

export async function startPlannerSyncScheduler(): Promise<void> {
  console.log('[PLANNER-SYNC] Starting Planner sync scheduler...');

  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
  if (webhookRenewalTask) {
    webhookRenewalTask.stop();
    webhookRenewalTask = null;
  }

  let pollCounter = 0;
  scheduledTask = cron.schedule('*/30 * * * *', async () => {
    pollCounter++;
    console.log(`[PLANNER-SYNC] Scheduled sync triggered (cycle ${pollCounter})`);
    try {
      const connections = await storage.getAllPlannerConnectionsWithSyncEnabled();
      for (const connection of connections) {
        if (connection.webhookActive && pollCounter % 2 !== 0) {
          console.log(`[PLANNER-SYNC] Skipping project ${connection.projectId} - webhook active (hourly safety-net only)`);
          continue;
        }
        try {
          await runPlannerSyncJob('scheduled', undefined, connection.projectId);
        } catch (err) {
          console.error(`[PLANNER-SYNC] Scheduled sync failed for project ${connection.projectId}:`, err);
        }
      }
    } catch (err) {
      console.error('[PLANNER-SYNC] Scheduled sync failed:', err);
    }
    try {
      await syncSupportTicketsFromPlanner();
    } catch (err) {
      console.error('[SUPPORT-PLANNER-SYNC] Scheduled sync failed:', err);
    }
  });

  webhookRenewalTask = cron.schedule('0 */6 * * *', async () => {
    console.log('[PLANNER-WEBHOOK] Running subscription renewal check...');
    await renewWebhookSubscriptions();
  });

  console.log('[PLANNER-SYNC] Scheduler started - polling every 30min (hourly for webhook-active connections), webhook renewal every 6 hours');
}

export function stopPlannerSyncScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
  if (webhookRenewalTask) {
    webhookRenewalTask.stop();
    webhookRenewalTask = null;
  }
  console.log('[PLANNER-SYNC] Scheduler stopped');
}

export async function restartPlannerSyncScheduler(): Promise<void> {
  stopPlannerSyncScheduler();
  await startPlannerSyncScheduler();
}
