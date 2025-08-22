import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useScrollToTop, useScrollToElement } from "@/hooks/useScrollToTop";
import Navigation from "@/components/ui/nav";
import EventForm from "@/components/ui/event-form";
import AuditModal from "@/components/ui/audit-modal";
import RecurringEventsManager from "@/components/ui/recurring-events-manager";
import { PaymentCollectionModal } from "@/components/payment-collection-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { LudiInlineLoader } from "@/components/ui/ludi-loader";
import {
  Users, Trophy, Target, Dumbbell, Zap, Mountain,
  Bike, Waves, Heart, Music, Flag, Swords, Circle, Plus
} from "lucide-react";

// Custom SVG sport icons
const FootballIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} fill="currentColor">
    <path d="M24,2A22,22,0,1,0,46,24,21.9,21.9,0,0,0,24,2ZM18.6,6.9,20,6.4A18.1,18.1,0,0,1,24,6a19.1,19.1,0,0,1,5.4.8l1.1,3.3L24,14.7l-6.5-4.6ZM6,23.8A17.6,17.6,0,0,1,9.4,13.6h3.4l2.3,7.6L8.8,25.9ZM18.3,41.1a18.2,18.2,0,0,1-8.8-6.4l1.1-3.3h7.9l2.6,7.6ZM20,29l-2.5-7.4L24,17l6.5,4.6L28,29Zm9.7,12.1-2.8-2,2.6-7.6h7.9l1.1,3.3A18.4,18.4,0,0,1,29.7,41.1Zm9.5-15.2-6.3-4.8,2.3-7.6h3.5A18.7,18.7,0,0,1,41.6,20a25.8,25.8,0,0,1,.4,3.8Z"/>
  </svg>
);

const RugbyIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 42.148 42.148" className={className} fill="currentColor">
    <path d="M41.203,14.814c-1.11-2.175-2.512-4.261-4.178-6.195c-0.535-0.621-1.096-1.227-1.684-1.814
c-0.592-0.59-1.199-1.146-1.822-1.682c-1.938-1.669-4.021-3.076-6.188-4.185C31.382,0.125,34.784,0,36.468,0
c0.568,0,0.885,0.015,0.885,0.015c2.586,0.121,4.672,2.197,4.781,4.784C42.148,5.146,42.296,9.379,41.203,14.814z M6.808,35.342
c-0.588-0.59-1.148-1.194-1.685-1.815c-1.666-1.933-3.065-4.021-4.178-6.195C-0.148,32.768,0,37.002,0.014,37.35
c0.109,2.586,2.197,4.662,4.783,4.783c0,0,0.312,0.016,0.881,0.016c1.683,0,5.088-0.126,9.138-0.938
c-2.168-1.109-4.25-2.517-6.188-4.186C8.008,36.487,7.398,35.930,6.808,35.342z M35.914,15.596c1.386,2.309,2.355,4.752,2.857,7.223
c-1.43,3.377-3.455,6.744-6.33,9.619c-2.879,2.879-6.242,4.905-9.619,6.337c-2.438-0.503-4.895-1.482-7.213-2.867
c-1.869-1.116-3.648-2.486-5.254-4.092c-0.004-0.004-0.008-0.01-0.012-0.014c-0.004-0.002-0.009-0.006-0.011-0.011
c-1.614-1.616-2.981-3.388-4.098-5.245c-1.386-2.309-2.354-4.75-2.856-7.222c1.43-3.377,3.454-6.745,6.329-9.62
c2.88-2.879,6.242-4.906,9.617-6.336c2.438,0.503,4.896,1.482,7.215,2.867c1.869,1.116,3.647,2.488,5.255,4.092
c0.005,0.004,0.009,0.007,0.013,0.011c0,0,0.002,0,0.002,0.001C33.429,11.961,34.798,13.736,35.914,15.596z M26.218,11.14
c-1.172-1.172-3.07-1.172-4.243,0c-0.668,0.668-0.94,1.572-0.848,2.444c0.07,0.656,0.346,1.295,0.848,1.798l4.792,4.791
c0.502,0.501,1.14,0.775,1.791,0.847c0.111,0.012,0.222,0.032,0.33,0.032c0.769,0,1.535-0.293,2.121-0.879
c1.172-1.171,1.172-3.071,0-4.242L26.218,11.14z M24.307,26.333c0.469-0.137,0.914-0.375,1.283-0.743
c0.367-0.371,0.607-0.815,0.744-1.285c0.297-1.018,0.057-2.156-0.744-2.958l-4.788-4.788c-0.804-0.803-1.943-1.042-2.961-0.745
c-0.47,0.136-0.912,0.375-1.281,0.744c-0.369,0.369-0.609,0.814-0.746,1.282c-0.297,1.018-0.057,2.158,0.746,2.96l4.787,4.789
c0.584,0.586,1.354,0.879,2.122,0.879C23.753,26.469,24.033,26.413,24.307,26.333z M15.933,31.008
c0.586,0.586,1.354,0.879,2.121,0.879s1.535-0.293,2.121-0.879c0.668-0.668,0.94-1.574,0.848-2.445
c-0.072-0.656-0.346-1.295-0.848-1.797l-4.79-4.792c-0.504-0.503-1.144-0.777-1.8-0.849c-0.87-0.094-1.774,0.18-2.442,0.849
c-1.172,1.171-1.172,3.07,0,4.242L15.933,31.008z"/>
  </svg>
);

const WalkingIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 96.65 122.88" className={className} fill="currentColor">
    <path d="M70.86,17.11c-3.23-0.33-6.28-1.44-8.4,0.33c-1.68,1.97-2.79,3.89-3.35,5.75c-1.66,5.53,1.54,10.59,8.9,15.25 c7.29,3.07,10.38,13.5,5.41,22.69c-4.04,7.47-11.43,9.91-16.72,16.49c-5.03,6.27-5.27,12.29-0.23,18.05 c9.62,5.84,17.69,2.61,20.09-9.05c1.35-6.55,1.03-11.68,3.32-18.68c1.81-5.54,4.67-11.12,9.24-16.77 c5.91-6.14,7.02-13.04,3.37-20.67c-1.54-1.34-2.93-2.92-4.12-4.85c-1.29-2.09-1.65-1.98-3.32-3.62c-0.34-0.34-0.66-0.68-0.97-1.04 C78.15,14.17,77.31,17.76,70.86,17.11L70.86,17.11z M39.31,47.13c0.86-0.96,1.73-1.55,3.05-0.79c1.37,0.78,1.62,2.28,1.41,3.74 c-0.09,0.63-0.21,1.24-0.52,1.76c-1.08,1.01-2.22,0.74-3.38-0.06c-0.39-0.24-0.72-0.53-0.97-0.87c-0.79-1.05-0.77-1.94-0.31-2.8 C38.77,47.78,39.01,47.46,39.31,47.13L39.31,47.13z M40.25,40.08c0.87,1.8,0.76,3.53-0.69,4.99c-1,1-2.32,1.33-3.29,0.78 c-1.08-0.61-2.16-2.14-2.17-3.79c-0.01-0.85,0.55-1.73,1.57-2.57C37.48,38.01,39.01,37.5,40.25,40.08L40.25,40.08z M32.64,32.23 c0.91-0.06,1.63,0.18,2.15,1.05c0.7,1.19,0.69,1.91,0.26,3.18c-0.08,0.25-0.18,0.49-0.29,0.73c-0.67,1.4-2.19,2.81-3.82,2.02 c-1.64-0.8-2.16-2.27-1.66-3.95C29.77,33.58,30.88,32.35,32.64,32.23L32.64,32.23z M21.71,33.85c-0.72-2.39,0.06-4.77,2.11-6.04 c0.45-0.28,0.93-0.45,1.44-0.52c1.11-0.12,2.03,0.25,2.7,1.22c1.08,1.56,1.07,3.75,0.07,5.39C26.54,36.35,22.47,36.36,21.71,33.85 L21.71,33.85z M17.36,25.04c2.79,1.39,4.2,4.58,1.31,9.3c-1.9,2.21-1.63,2.58-4.52,4.18c-1.56,0.87-2.69,0.26-3.46-1.54l-1.05-3.95 c-0.34-1.65,0.1-3.42,0.76-4.96C11.78,24.9,14.07,23.4,17.36,25.04L17.36,25.04z M18.05,41.48c-3.23-0.33-6.28-1.44-8.4,0.33 c-1.68,1.97-2.79,3.89-3.35,5.75c-1.66,5.53,1.54,10.59,8.9,15.25c7.29,3.07,10.38,13.5,5.41,22.69 C16.58,92.97,9.18,95.4,3.9,101.98c-5.03,6.26-5.27,12.29-0.23,18.05c9.62,5.84,17.69,2.61,20.09-9.05 c1.35-6.55,1.03-11.68,3.32-18.68c1.81-5.54,4.67-11.12,9.23-16.77c5.91-6.14,7.02-13.04,3.37-20.67 c-1.54-1.34-2.93-2.92-4.12-4.85c-1.29-2.09-1.65-1.98-3.32-3.62c-0.34-0.34-0.66-0.68-0.97-1.04 C25.35,38.54,24.51,42.13,18.05,41.48L18.05,41.48z M92.11,22.76c0.86-0.96,1.73-1.55,3.05-0.79c1.37,0.78,1.62,2.28,1.41,3.74 c-0.09,0.63-0.21,1.24-0.52,1.76c-1.08,1.01-2.22,0.74-3.38-0.06c-0.39-0.24-0.72-0.53-0.97-0.87c-0.79-1.05-0.77-1.94-0.31-2.8 C91.57,23.41,91.82,23.09,92.11,22.76L92.11,22.76z M93.06,15.71c0.87,1.8,0.76,3.53-0.69,5c-1,1.01-2.32,1.33-3.29,0.78 c-1.08-0.61-2.16-2.14-2.17-3.79c-0.01-0.85,0.55-1.73,1.57-2.57C90.29,13.63,91.81,13.13,93.06,15.71L93.06,15.71z M85.44,7.85 c0.91-0.06,1.63,0.18,2.15,1.05c0.7,1.19,0.69,1.91,0.26,3.18c-0.08,0.25-0.18,0.49-0.29,0.73c-0.67,1.4-2.19,2.81-3.82,2.02 c-1.64-0.8-2.16-2.27-1.66-3.95C82.57,9.21,83.68,7.98,85.44,7.85L85.44,7.85z M74.51,9.48c-0.72-2.39,0.06-4.77,2.11-6.04 c0.45-0.28,0.93-0.45,1.44-0.52c1.11-0.12,2.03,0.25,2.7,1.22c1.08,1.56,1.07,3.75,0.07,5.39C79.35,11.98,75.27,11.99,74.51,9.48 L74.51,9.48z M70.16,0.67c2.79,1.39,4.2,4.58,1.31,9.3c-1.9,2.21-1.63,2.58-4.52,4.18c-1.56,0.87-2.69,0.26-3.46-1.54l-1.05-3.95 c-0.34-1.65,0.1-3.42,0.76-4.96C64.58,0.53,66.88-0.97,70.16,0.67L70.16,0.67z"/>
  </svg>
);

const HikingIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 296 296" className={className} fill="currentColor">
    <path d="M94.061,271.915c2.832-0.062,69.59-1.974,89.994-6.276c6.832-1.44,10.294-0.979,11.706,0.315
c3.615,3.313,5.219,5.961,9.236,5.961h80.867c5.597,0,10.136-4.538,10.136-10.136V34.221c0-3.474-1.78-6.707-4.715-8.565
c-2.936-1.857-6.619-2.084-9.76-0.595c-0.22,0.104-22.362,10.408-56.326,10.409c-20.073,0.001-40.089-3.62-59.493-10.761
c-3.365-1.237-7.138-0.606-9.915,1.664c-2.778,2.27-4.148,5.839-3.605,9.385c4.732,30.848,6.152,85.875-10.186,102.213
c-18.773,18.775-74.889,39.206-101.857,49.025c-8.813,3.209-14.636,5.328-17.637,6.752c-20.329,9.641-28.373,36.409-17.932,59.67
c1.025,2.285,2.861,4.109,5.152,5.12c1.202,0.53,29.954,13.376,74.718,13.376H94.061z M155.15,153.433
c1.795-1.795,4.645-4.953,6.19-7.204l6.168,2.548c1.266,0.524,2.576,0.771,3.866,0.771c3.981,0,7.757-2.361,9.372-6.268
c2.138-5.174-0.324-11.101-5.497-13.238l-5.429-2.243c1.101-3.63,2.045-7.536,2.832-11.718l2.457,1.015
c1.266,0.523,2.576,0.77,3.865,0.77c3.981,0,7.758-2.362,9.373-6.27c2.136-5.174-0.326-11.101-5.499-13.238l-7.703-3.181
c0.288-4.695,0.437-9.627,0.447-14.795c19.068,5.582,36.559,7.579,51.807,7.579c20.873,0,37.542-3.731,48.33-7.092v66.851
c-13.156,1.304-36.062,6.057-52.633,22.951c-12.749,12.998-19.196,30.398-19.251,51.766c-8.232,2.194-16.774,5.082-25.633,8.9
c-30.682,13.225-62.229,19.931-93.766,19.931c-2.049,0-4.059-0.03-6.034-0.086c4.964-26.69-1.849-43.529-9.139-53.351
c3.699-1.405,7.515-2.881,11.404-4.421l7.363,8.941c2.004,2.433,4.906,3.692,7.83,3.692c2.268,0,4.55-0.757,6.438-2.311
c4.321-3.559,4.939-9.947,1.381-14.268l-3.432-4.168c2.607-1.136,5.204-2.293,7.78-3.472l10.284,7.926
c1.843,1.42,4.02,2.107,6.18,2.107c3.036,0,6.039-1.358,8.035-3.948c3.417-4.434,2.592-10.798-1.841-14.216l-2.453-1.891
c3.111-1.692,6.114-3.408,8.967-5.147l9.519,5.286c1.197,0.666,2.471,1.062,3.752,1.210c3.955,0.458,7.977-1.454,10.03-5.15
c2.717-4.894,0.954-11.065-3.94-13.782L155.15,153.433z M224.229,218.216c0.788-13.868,5.224-25.032,13.253-33.263
c11.399-11.685,27.883-15.542,38.246-16.813v47.565c-3.398-0.027-6.817-0.053-10.263-0.053
C252.888,215.652,239.143,215.974,224.229,218.216z M225.2,55.742c21.629-0.001,39.146-3.748,50.529-7.118v10.81
c-12.789,4.838-51.234,16.024-100.833-0.512c-0.237-3.695-0.514-7.133-0.799-10.219C190.888,53.381,208.015,55.743,225.2,55.742z
 M48.84,205.403c4.44,3.678,15.143,15.844,9.205,44.234c-17.681-2.209-30.424-6.114-36.37-8.214
c-3.989-12.951,1.34-25.48,9.517-29.358C33.335,211.048,41.465,208.088,48.84,205.403z M210.023,251.643
c-2.55-2.525-6.387-5.036-12.007-6.255c25.039-8.645,46.98-9.465,67.449-9.465c3.441,0,6.854,0.027,10.245,0.053
c0.006,0,0.013,0,0.019,0v15.666H210.023z"/>
  </svg>
);

const WildCampingIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 122.88 119.63" className={className} fill="currentColor">
    <path d="M44.27,115.28H78.5L60.7,77.5L44.27,115.28L44.27,115.28z M59.51,1.93c0-1.06,0.86-1.93,1.93-1.93 c1.06,0,1.93,0.86,1.93,1.93v18.08l3.75,6.94l9.72-16.83c0.53-0.92,1.7-1.24,2.62-0.71c0.92,0.53,1.24,1.7,0.71,2.62l-10.9,18.89 l45.78,84.86h5.92c1.06,0,1.93,0.86,1.93,1.93c0,1.06-0.86,1.93-1.93,1.93H1.93c-1.06,0-1.93-0.86-1.93-1.93 c0-1.06,0.86-1.93,1.93-1.93h5.92l45.71-84.99L42.72,12.03c-0.53-0.92-0.21-2.09,0.71-2.62s2.09-0.21,2.62,0.71l9.64,16.69 l3.83-7.12V1.93L59.51,1.93z"/>
  </svg>
);

const TennisIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
    <path d="M4.5 12c0-4 3.5-7.5 7.5-7.5s7.5 3.5 7.5 7.5-3.5 7.5-7.5 7.5-7.5-3.5-7.5-7.5z" fill="none" stroke="currentColor" strokeWidth="0.5"/>
    <path d="M12 3.5v17M3.5 12h17" stroke="currentColor" strokeWidth="0.5"/>
  </svg>
);

const GolfIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2v14" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M12 2l4 4-4 2V2z" fill="currentColor"/>
    <circle cx="12" cy="19" r="1" fill="currentColor"/>
    <path d="M8 22h8" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const BasketballIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <circle cx="12" cy="12" r="9" fill="currentColor"/>
    <path d="M3 12h18M12 3v18M7 7l10 10M17 7L7 17" stroke="white" strokeWidth="0.8" fill="none"/>
  </svg>
);

// Function to get sport icon component based on sport name
const getSportIcon = (sport: string) => {
  const sportLower = sport?.toLowerCase() || '';
  

  
  // Check rugby first with multiple variations
  if (sportLower.includes('rugby') || sportLower === 'rugby') return RugbyIcon; // Oval rugby ball
  if (sportLower.includes('walking')) return WalkingIcon; // Footprint icon
  if (sportLower.includes('hiking')) return HikingIcon; // Hiking boot
  if (sportLower.includes('wild camping') || sportLower.includes('camping')) return WildCampingIcon; // Tent icon
  if (sportLower.includes('football') && !sportLower.includes('american')) return FootballIcon; // Soccer ball with pentagon pattern
  if (sportLower.includes('soccer')) return FootballIcon; // Soccer ball
  if (sportLower.includes('basketball')) return BasketballIcon; // Basketball with lines
  if (sportLower.includes('volleyball')) return Circle; // Volleyball
  if (sportLower.includes('tennis')) return TennisIcon; // Tennis ball with curved lines
  if (sportLower.includes('badminton')) return Swords; // Badminton racquet
  if (sportLower.includes('baseball') || sportLower.includes('cricket')) return Circle; // Ball sports
  if (sportLower.includes('golf')) return GolfIcon; // Golf flag and hole
  if (sportLower.includes('swimming')) return Waves; // Keep as is
  if (sportLower.includes('running') || sportLower.includes('marathon')) return Zap; // Keep as is
  if (sportLower.includes('cycling') || sportLower.includes('biking')) return Bike; // Keep as is
  if (sportLower.includes('boxing') || sportLower.includes('wrestling') || sportLower.includes('martial')) return Dumbbell;
  if (sportLower.includes('skiing') || sportLower.includes('snowboard')) return Mountain;
  if (sportLower.includes('climbing') || sportLower.includes('rock')) return Mountain;
  if (sportLower.includes('yoga') || sportLower.includes('meditation')) return Heart;
  if (sportLower.includes('dance') || sportLower.includes('social')) return Music;
  
  // Default fallback icon
  return Users;
};

export default function Events() {
  useScrollToTop();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  useScrollToElement((editingEvent || showCreateForm) ? `edit-form` : undefined);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [votingStatusFilter, setVotingStatusFilter] = useState<string>("all");
  const [showPastEvents, setShowPastEvents] = useState<boolean>(false);
  const [auditModal, setAuditModal] = useState<{ isOpen: boolean; eventId: string; eventName: string }>({
    isOpen: false,
    eventId: "",
    eventName: "",
  });
  const [recurringManager, setRecurringManager] = useState<{
    isOpen: boolean;
    eventId: string;
    recurringSeriesId: string;
  }>({
    isOpen: false,
    eventId: "",
    recurringSeriesId: "",
  });

  const [paymentCollectionModal, setPaymentCollectionModal] = useState<{
    isOpen: boolean;
    eventId: string;
    eventName: string;
    eventCost: string;
    eventCreatorId: string;
  }>({
    isOpen: false,
    eventId: "",
    eventName: "",
    eventCost: "",
    eventCreatorId: "",
  });

  // Extract team parameter from URL
  useEffect(() => {
    // Get the full URL to handle query parameters properly
    const fullUrl = window.location.href;
    const url = new URL(fullUrl);
    const teamParam = url.searchParams.get('team');
    setSelectedTeamId(teamParam || null);
  }, [location]);

  // Show create form when navigating to /events/new
  useEffect(() => {
    if (location.startsWith('/events/new')) {
      setShowCreateForm(true);
      setEditingEvent(null);
    }
  }, [location]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["/api/events", { includePast: showPastEvents }],
    queryFn: async () => {
      const response = await fetch(`/api/events?includePast=${showPastEvents}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      return response.json();
    },
  });

  // Pre-fetch event details, attendance, and potential players for all events
  // This will cache the data so event details page loads instantly
  useEffect(() => {
    if (events && Array.isArray(events)) {
      events.forEach((event: any) => {
        // Pre-fetch event details (already have basic info, but ensure it's cached)
        queryClient.prefetchQuery({
          queryKey: ["/api/events", event.id],
          staleTime: 60000, // Cache for 1 minute
        });
        
        // Pre-fetch attendance data
        queryClient.prefetchQuery({
          queryKey: ["/api/events", event.id, "attendance"],
          staleTime: 30000, // Cache for 30 seconds
        });
        
        // Pre-fetch potential players
        queryClient.prefetchQuery({
          queryKey: ["/api/events", event.id, "potential-players"],
          staleTime: 30000, // Cache for 30 seconds
        });
      });
    }
  }, [events]);

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
  });

  // Fetch attendance data for all events to determine voting status
  const attendanceQueries = useQuery({
    queryKey: ["/api/events/attendance-all"],
    queryFn: async () => {
      if (!events || events.length === 0) return {};
      
      const attendanceData: { [eventId: string]: any[] } = {};
      await Promise.all(
        (events as any[]).map(async (event) => {
          try {
            const response = await fetch(`/api/events/${event.id}/attendance`, {
              credentials: "include",
            });
            if (response.ok) {
              attendanceData[event.id] = await response.json();
            }
          } catch (error) {
            console.error(`Failed to fetch attendance for event ${event.id}:`, error);
          }
        })
      );
      return attendanceData;
    },
    enabled: events && (events as any[]).length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });

  const { user } = useAuth();

  // Helper function to check if user can edit an event
  const canEditEvent = (event: any) => {
    if (!user || !event?.primaryTeamId) return false;
    
    // User can edit if they created the event directly
    if (event.createdById === (user as any).id) return true;
    
    const primaryTeam = (teams as any[]).find((team: any) => team.id === event.primaryTeamId);
    if (!primaryTeam) return false;
    
    // User can edit if they're the team owner
    if (primaryTeam.ownerId === (user as any).id) return true;
    
    // User can edit if they have admin or captain role in the team
    // The team object already contains the user's role since getUserTeams returns the user's role
    return primaryTeam.role === "admin" || primaryTeam.role === "captain";
  };

  // Helper function to get user's voting status for an event
  const getUserVotingStatus = (eventId: string): 'attending' | 'not_attending' | 'not_voted' => {
    const attendanceData = attendanceQueries.data?.[eventId] || [];
    const userAttendance = attendanceData.find((a: any) => a.userId === (user as any)?.id);
    
    if (!userAttendance) return 'not_voted';
    return userAttendance.status === 'attending' ? 'attending' : 'not_attending';
  };

  // Helper function to check if event is in the past
  const isEventPast = (event: any): boolean => {
    const now = new Date();
    
    // Calculate actual event end time
    let eventEndTime: Date;
    if (event.endDate && event.endTime) {
      eventEndTime = new Date(`${event.endDate} ${event.endTime}`);
    } else if (event.startDate && event.endTime) {
      eventEndTime = new Date(`${event.startDate} ${event.endTime}`);
    } else {
      // Fallback to end of start date if no end time specified
      eventEndTime = new Date(event.startDate);
      eventEndTime.setHours(23, 59, 59);
    }
    
    return eventEndTime < now;
  };

  // Apply all filters (past events filter is now handled server-side)
  const filteredEvents = (events as any[])
    .filter((event: any) => {
      // Team filter
      if (selectedTeamId && event.primaryTeamId !== selectedTeamId) return false;
      
      // Voting status filter
      if (votingStatusFilter !== 'all') {
        const votingStatus = getUserVotingStatus(event.id);
        if (votingStatusFilter !== votingStatus) return false;
      }
      
      return true;
    });

  // Calculate filter counts (events array already filtered by server for past/future)
  const allEventsCount = events.length;
  
  // For past events count, we need to make a separate query
  const { data: allEventsData = [] } = useQuery({
    queryKey: ["/api/events", { includePast: true }],
    queryFn: async () => {
      const response = await fetch(`/api/events?includePast=true`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch all events");
      }
      return response.json();
    },
    enabled: showPastEvents, // Only fetch when we need the count
  });
  
  const pastEventsCount = showPastEvents ? 
    (allEventsData as any[]).filter(event => isEventPast(event)).length : 
    0; // We don't show this when showPastEvents is false anyway
  
  const attendingCount = (events as any[]).filter(event => 
    (!selectedTeamId || event.primaryTeamId === selectedTeamId) &&
    getUserVotingStatus(event.id) === 'attending'
  ).length;
  
  const notAttendingCount = (events as any[]).filter(event => 
    (!selectedTeamId || event.primaryTeamId === selectedTeamId) &&
    getUserVotingStatus(event.id) === 'not_attending'
  ).length;
  
  const notVotedCount = (events as any[]).filter(event => 
    (!selectedTeamId || event.primaryTeamId === selectedTeamId) &&
    getUserVotingStatus(event.id) === 'not_voted'
  ).length;

  const selectedTeam = selectedTeamId 
    ? (teams as any[]).find((team: any) => team.id === selectedTeamId)
    : null;

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    },
  });



  if (isLoading) {
    return (
      <div className="relative min-h-screen bg-neutral-50">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LudiInlineLoader size="md" message="Loading events..." />
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-neutral-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">
                {selectedTeam ? `${selectedTeam.name} Events` : "Events"}
              </h1>
              {selectedTeam && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => {
                    setSelectedTeamId(null);
                    window.history.pushState({}, '', '/events');
                  }}
                >
                  <i className="fas fa-arrow-left mr-2"></i>
                  Back to All Events
                </Button>
              )}
            </div>
            <Button
              onClick={() => {
                setLocation('/events/new');
              }}
              className="flex items-center space-x-2"
            >
              <i className="fas fa-plus"></i>
              <span>Create Event</span>
            </Button>
          </div>

          {/* Filters */}
          <div className="mt-6 space-y-4">
            {/* First row - Team and Voting Status filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-neutral-600">Filter by Team:</label>
                <Select 
                  value={selectedTeamId || "all"} 
                  onValueChange={(value) => {
                    if (value === "all") {
                      setSelectedTeamId(null);
                      window.history.pushState({}, '', '/events');
                    } else {
                      setSelectedTeamId(value);
                      window.history.pushState({}, '', `/events?team=${value}`);
                    }
                  }}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {(teams as any[]).map((team: any) => (
                      <SelectItem key={team.id} value={team.id}>
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: team.color || '#3b82f6' }}
                          />
                          <span>{team.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-neutral-600">Voting Status:</label>
                <Select 
                  value={votingStatusFilter} 
                  onValueChange={setVotingStatusFilter}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ({allEventsCount})</SelectItem>
                    <SelectItem value="attending">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>Attending ({attendingCount})</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="not_attending">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span>Can't Attend ({notAttendingCount})</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="not_voted">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-neutral-400"></div>
                        <span>Not Voted ({notVotedCount})</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Second row - Past events toggle and event count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-past-events"
                    checked={showPastEvents}
                    onCheckedChange={setShowPastEvents}
                  />
                  <Label 
                    htmlFor="show-past-events" 
                    className="text-sm font-medium text-neutral-600 cursor-pointer"
                  >
                    Show Past Events ({pastEventsCount})
                  </Label>
                </div>
              </div>

              {filteredEvents.length !== events.length && (
                <Badge variant="secondary" className="text-xs">
                  Showing {filteredEvents.length} of {allEventsCount} events
                </Badge>
              )}
            </div>
          </div>
        </div>

        {(showCreateForm || editingEvent) && (
          <div id="edit-form" className="mb-8">
            <EventForm
              eventId={editingEvent || undefined}
              onCancel={() => {
                setShowCreateForm(false);
                setEditingEvent(null);
                if (location.startsWith('/events/new')) {
                  setLocation('/events');
                }
              }}
              onSuccess={() => {
                setShowCreateForm(false);
                setEditingEvent(null);
                if (location.startsWith('/events/new')) {
                  setLocation('/events');
                }
              }}
            />
          </div>
        )}

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(filteredEvents as any[]).length === 0 ? (
            <div className="col-span-full text-center py-12">
              <i className="fas fa-calendar text-neutral-300 text-6xl mb-4"></i>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                {events.length === 0 
                  ? "No events yet" 
                  : "No events match your filters"
                }
              </h3>
              <p className="text-neutral-500 mb-4">
                {events.length === 0 
                  ? "Create your first sports event to get started"
                  : "Try adjusting your filters to see more events"
                }
              </p>
              {events.length === 0 && (
                <Button onClick={() => {
                  setShowCreateForm(true);
                  setEditingEvent(null);
                }}>
                  Create Event
                </Button>
              )}
            </div>
          ) : (
            (filteredEvents as any[]).map((event: any) => {
              // Use primary team color or fallback to default
              const teamColor = event.primaryTeam?.color || "#3b82f6";
              
              // Handle hover prefetching for instant loading
              const handleHover = () => {
                // Pre-fetch activity logs on hover for instant loading
                queryClient.prefetchQuery({
                  queryKey: ["/api/events", event.id, "activity"],
                  staleTime: 30000,
                });
              };

              return (
                <Card 
                  id={`event-${event.id}`}
                  key={event.id} 
                  className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  onMouseEnter={handleHover}
                >
                  <div 
                    className="h-32 relative flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}dd 100%)` 
                    }}
                  >
                    {(() => {
                      const IconComponent = getSportIcon(event.sport || '');
                      return <IconComponent className="text-white w-16 h-16 opacity-50" />;
                    })()}
                    
                    <div className="absolute top-4 right-4 flex gap-2">
                      {event.recurringSeriesId && (
                        <Badge 
                          variant="secondary" 
                          className="bg-white/20 text-white border-white/30"
                        >
                          Recurring
                        </Badge>
                      )}
                      <Badge 
                        variant={event.isPublished ? "default" : "secondary"}
                        className={event.isPublished ? "" : "bg-white/20 text-white border-white/30"}
                      >
                        {event.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  </div>
                  
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: teamColor }}
                      >
                        {(() => {
                          const IconComponent = getSportIcon(event.sport || '');
                          return <IconComponent className="w-6 h-6 text-white" />;
                        })()}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900">
                          {event.name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm text-neutral-500">{event.sport}</p>
                          {event.primaryTeam && (
                            <span 
                              className="text-xs px-2 py-1 rounded-full text-white font-medium max-w-32 truncate"
                              style={{ backgroundColor: teamColor }}
                              title={event.primaryTeam.name}
                            >
                              {event.primaryTeam.name.length > 15 ? `${event.primaryTeam.name.substring(0, 15)}...` : event.primaryTeam.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Date:</span>
                      <span className="font-medium text-neutral-900">
                        {new Date(event.startDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Time:</span>
                      <span className="font-medium text-neutral-900">{event.startTime}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-start justify-between text-sm">
                        <span className="text-neutral-500 flex-shrink-0">Location:</span>
                        <span className="font-medium text-neutral-900 text-right ml-2 break-words">
                          {event.location.length > 30 ? `${event.location.substring(0, 30)}...` : event.location}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Cost:</span>
                      <span className="font-medium text-neutral-900">
                        {(!event.cost || parseFloat(event.cost) === 0) ? "Unknown" : `£${parseFloat(event.cost).toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    {event.isPublished && (
                      <Button 
                        size="sm" 
                        style={{ 
                          backgroundColor: teamColor,
                          borderColor: teamColor
                        }}
                        onClick={async () => {
                          // Pre-load event data before navigation
                          await Promise.all([
                            queryClient.prefetchQuery({
                              queryKey: ["/api/events", event.id],
                            }),
                            queryClient.prefetchQuery({
                              queryKey: ["/api/events", event.id, "attendance"],
                            }),
                            queryClient.prefetchQuery({
                              queryKey: ["/api/events", event.id, "activity"],
                            }),
                          ]);
                          setLocation(`/events/${event.id}`);
                        }}
                      >
                        {isEventPast(event) ? "View" : "Vote"}
                      </Button>
                    )}
                    
                    {/* Show Collect Payment button for past paid events (admins/captains only) */}
                    {isEventPast(event) && 
                     event.cost && parseFloat(event.cost) > 0 && 
                     !event.paymentCollectionInitiated &&
                     canEditEvent(event) && (
                      <Button 
                        size="sm" 
                        style={{ 
                          backgroundColor: "#10b981",
                          borderColor: "#10b981"
                        }}
                        onClick={() => setPaymentCollectionModal({
                          isOpen: true,
                          eventId: event.id,
                          eventName: event.name,
                          eventCost: event.cost,
                          eventCreatorId: event.createdById,
                        })}
                      >
                        Collect Payment
                      </Button>
                    )}
                    
                    {/* Hide Edit/Delete buttons for past events */}
                    {!isEventPast(event) && canEditEvent(event) && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        style={{ 
                          borderColor: teamColor,
                          color: teamColor
                        }}
                        onClick={() => {
                          setEditingEvent(event.id);
                          setShowCreateForm(false);
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    {isEventPast(event) && canEditEvent(event) && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        style={{ 
                          borderColor: teamColor,
                          color: teamColor
                        }}
                        className="hover:bg-opacity-10"
                        onClick={() => setAuditModal({
                          isOpen: true,
                          eventId: event.id,
                          eventName: event.name,
                        })}
                      >
                        Audit
                      </Button>
                    )}
                    {event.recurringSeriesId && !isEventPast(event) && canEditEvent(event) && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        style={{ 
                          borderColor: teamColor,
                          color: teamColor
                        }}
                        onClick={() => setRecurringManager({
                          isOpen: true,
                          eventId: event.id,
                          recurringSeriesId: event.recurringSeriesId,
                        })}
                      >
                        Manage Series
                      </Button>
                    )}
                    {!isEventPast(event) && canEditEvent(event) && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => deleteEventMutation.mutate(event.id)}
                        disabled={deleteEventMutation.isPending}
                        className="hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
            })
          )}
        </div>
      </main>

      <Button
        onClick={() => setLocation('/events/new')}
        className="absolute bottom-6 right-6 rounded-full h-14 w-14 p-0 md:hidden flex items-center justify-center"
        aria-label="Create Event"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Audit Modal */}
      <AuditModal
        eventId={auditModal.eventId}
        eventName={auditModal.eventName}
        isOpen={auditModal.isOpen}
        onClose={() => setAuditModal({ isOpen: false, eventId: "", eventName: "" })}
      />

      {/* Recurring Events Manager Modal */}
      {recurringManager.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <RecurringEventsManager
            eventId={recurringManager.eventId}
            recurringSeriesId={recurringManager.recurringSeriesId}
            onClose={() => setRecurringManager({ isOpen: false, eventId: "", recurringSeriesId: "" })}
          />
        </div>
      )}

      {/* Payment Collection Modal */}
      <PaymentCollectionModal
        isOpen={paymentCollectionModal.isOpen}
        onClose={() => setPaymentCollectionModal({
          isOpen: false,
          eventId: "",
          eventName: "",
          eventCost: "",
          eventCreatorId: "",
        })}
        eventId={paymentCollectionModal.eventId}
        eventName={paymentCollectionModal.eventName}
        eventCost={paymentCollectionModal.eventCost}
        eventCreatorId={paymentCollectionModal.eventCreatorId}
      />
    </div>
  );
}
