import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clubsApi } from '../api/clubs';
import { ClubFilters, Pagination } from '@/types/api.types';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { studentKeys } from './useStudent';
import { statsKeys } from './useStats';

// Query keys
export const clubKeys = {
  all: ['clubs'] as const,
  lists: () => [...clubKeys.all, 'list'] as const,
  list: (filters?: ClubFilters, pagination?: Pagination) => 
    [...clubKeys.lists(), { filters, pagination }] as const,
  details: () => [...clubKeys.all, 'detail'] as const,
  detail: (id: string) => [...clubKeys.details(), id] as const,
  members: (id: string) => [...clubKeys.detail(id), 'members'] as const,
  invite: (id: string) => [...clubKeys.detail(id), 'invite'] as const,
};

// Fetch clubs with filters
export function useClubs(filters?: ClubFilters, pagination?: Pagination) {
  return useQuery({
    queryKey: clubKeys.list(filters, pagination),
    queryFn: () => clubsApi.getClubs(filters, pagination),
  });
}

// Fetch single club
export function useClub(id: string) {
  return useQuery({
    queryKey: clubKeys.detail(id),
    queryFn: () => clubsApi.getClub(id),
    enabled: !!id,
  });
}

// Fetch club members
export function useClubMembers(clubId: string, status?: 'pending' | 'active' | 'rejected') {
  return useQuery({
    queryKey: [...clubKeys.members(clubId), status],
    queryFn: () => clubsApi.getMembers(clubId, status),
    enabled: !!clubId,
  });
}

// Join club mutation
export function useJoinClub() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (clubId: string) => clubsApi.joinClub(clubId),
    onSuccess: (membership, clubId) => {
      queryClient.invalidateQueries({ queryKey: clubKeys.detail(clubId) });
      queryClient.invalidateQueries({ queryKey: clubKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clubKeys.members(clubId) });
      if (user?.studentId) {
        queryClient.invalidateQueries({ queryKey: studentKeys.memberships(user.studentId) });
        queryClient.invalidateQueries({ queryKey: statsKeys.student(user.studentId) });
      }
      toast.success(membership.status === 'active' ? 'Successfully joined club!' : 'Request sent for approval');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to join club');
    },
  });
}

// Leave club mutation
export function useLeaveClub() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ clubId, studentId }: { clubId: string; studentId: string }) =>
      clubsApi.leaveClub(clubId, studentId),
    onSuccess: (_, { clubId }) => {
      queryClient.invalidateQueries({ queryKey: clubKeys.detail(clubId) });
      queryClient.invalidateQueries({ queryKey: clubKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clubKeys.members(clubId) });
      queryClient.invalidateQueries({ queryKey: statsKeys.platform });
      if (user?.studentId) {
        queryClient.invalidateQueries({ queryKey: studentKeys.memberships(user.studentId) });
        queryClient.invalidateQueries({ queryKey: statsKeys.student(user.studentId) });
      }
      toast.success('Left club successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to leave club');
    },
  });
}

// Create club mutation
export function useCreateClub() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: clubsApi.createClub,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clubKeys.lists() });
      queryClient.invalidateQueries({ queryKey: statsKeys.platform });
      if (user?.studentId) {
        queryClient.invalidateQueries({ queryKey: studentKeys.memberships(user.studentId) });
        queryClient.invalidateQueries({ queryKey: statsKeys.student(user.studentId) });
      }
      toast.success('Club created successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create club');
    },
  });
}

// Update club mutation
export function useUpdateClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      clubsApi.updateClub(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: clubKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: clubKeys.lists() });
      toast.success('Club updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update club');
    },
  });
}

// Fetch club invite
export function useClubInvite(clubId: string) {
  return useQuery({
    queryKey: clubKeys.invite(clubId),
    queryFn: () => clubsApi.getInvite(clubId),
    enabled: !!clubId,
  });
}

// Join via invite mutation
export function useJoinViaInvite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (token: string) => clubsApi.joinViaInvite(token),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: clubKeys.detail(data.clubId) });
      queryClient.invalidateQueries({ queryKey: clubKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clubKeys.members(data.clubId) });
      if (user?.studentId) {
        queryClient.invalidateQueries({ queryKey: studentKeys.memberships(user.studentId) });
        queryClient.invalidateQueries({ queryKey: statsKeys.student(user.studentId) });
      }
      toast.success(data.membership.status === 'active' ? 'Successfully joined club!' : 'Request sent for approval');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to join club');
    },
  });
}

// Update membership status mutation
export function useUpdateMembershipStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      clubId, 
      studentId, 
      status 
    }: { 
      clubId: string; 
      studentId: string; 
      status: 'active' | 'rejected' 
    }) => clubsApi.updateMemberStatus(clubId, studentId, { status }),
    onSuccess: (_, { clubId, studentId }) => {
      queryClient.invalidateQueries({ queryKey: clubKeys.detail(clubId) });
      queryClient.invalidateQueries({ queryKey: clubKeys.members(clubId) });
      queryClient.invalidateQueries({ queryKey: studentKeys.memberships(studentId) });
      queryClient.invalidateQueries({ queryKey: statsKeys.student(studentId) });
      queryClient.invalidateQueries({ queryKey: statsKeys.platform });
      toast.success('Membership status updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update membership status');
    },
  });
}

// Delete club mutation
export function useDeleteClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clubId: string) => clubsApi.deleteClub(clubId),
    onSuccess: (_, clubId) => {
      queryClient.removeQueries({ queryKey: clubKeys.detail(clubId) });
      queryClient.invalidateQueries({ queryKey: clubKeys.lists() });
      toast.success('Club deleted successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete club');
    },
  });
}
