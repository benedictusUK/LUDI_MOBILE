import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import Navigation from "@/components/ui/nav";
import TeamForm from "@/components/ui/team-form";
import { MemberManagementModal } from "@/components/ui/member-management-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from '@uppy/core';
import {
  Users, Trophy, Target, Dumbbell, Zap, Mountain,
  Bike, Waves, Heart, Music, Flag, Swords, Circle
} from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";

// Sports options
const SPORTS_OPTIONS = [
  "Football", "Basketball", "Tennis", "Baseball", "Soccer", "Rugby", 
  "Cricket", "Volleyball", "Swimming", "Running", "Cycling", "Golf",
  "Hockey", "Badminton", "Table Tennis", "Boxing", "Wrestling", "Skiing",
  "Snowboarding", "Surfing", "Rock Climbing", "Martial Arts", "Yoga", "Other"
];

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
c-2.168-1.109-4.25-2.517-6.188-4.186C8.008,36.487,7.398,35.93,6.808,35.342z M35.914,15.596c1.386,2.309,2.355,4.752,2.857,7.223
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
c3.111-1.692,6.114-3.408,8.967-5.147l9.519,5.286c1.197,0.666,2.471,1.062,3.752,1.21c3.955,0.458,7.977-1.454,10.03-5.15
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

// Multi-select component for sports
function SportsMultiSelect({ 
  value, 
  onChange, 
  placeholder = "Select sports...",
  disabled = false
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [selectedSports, setSelectedSports] = useState<string[]>(value);
  const [isOpen, setIsOpen] = useState(false);

  const toggleSport = (sport: string) => {
    if (disabled) return;
    const newSelection = selectedSports.includes(sport)
      ? selectedSports.filter(s => s !== sport)
      : [...selectedSports, sport];
    
    setSelectedSports(newSelection);
    onChange(newSelection);
  };

  const removeSport = (sport: string) => {
    if (disabled) return;
    const newSelection = selectedSports.filter(s => s !== sport);
    setSelectedSports(newSelection);
    onChange(newSelection);
  };

  return (
    <div className="space-y-2">
      <Select open={isOpen} onOpenChange={setIsOpen} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder}>
            {selectedSports.length === 0 ? placeholder : `${selectedSports.length} sport${selectedSports.length !== 1 ? 's' : ''} selected`}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SPORTS_OPTIONS.map(sport => (
            <SelectItem 
              key={sport} 
              value={sport}
              onSelect={(e) => {
                e.preventDefault();
                toggleSport(sport);
              }}
            >
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedSports.includes(sport)}
                  onChange={() => toggleSport(sport)}
                  className="rounded"
                />
                <span>{sport}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {selectedSports.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSports.map(sport => (
            <Badge 
              key={sport} 
              variant="secondary" 
              className={disabled ? "" : "cursor-pointer"}
              onClick={() => !disabled && removeSport(sport)}
            >
              {sport}
              {!disabled && <i className="fas fa-times ml-1"></i>}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Team Settings Modal Component
function TeamSettingsModal({ team, onClose, onSave, isLoading }: {
  team: any;
  onClose: () => void;
  onSave: (updates: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: team.name || "",
    sports: team.sports || [],
    description: team.description || "",
    isPrivate: team.isPrivate || false,
    requiresApproval: team.requiresApproval || false,
  });

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div 
          className="p-6 border-b"
          style={{ 
            background: `linear-gradient(135deg, ${team.color || '#3b82f6'}, ${team.color || '#3b82f6'}dd)` 
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              Team Settings
            </h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <i className="fas fa-times"></i>
            </Button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-neutral-900">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={team.role !== "admin"}
                />
              </div>
              <div>
                <Label htmlFor="teamSports">Sports</Label>
                <SportsMultiSelect
                  value={formData.sports}
                  onChange={(value) => setFormData({ ...formData, sports: value })}
                  placeholder="Select sports..."
                  disabled={team.role !== "admin"}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="teamDescription">Description</Label>
              <Textarea
                id="teamDescription"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your team..."
                disabled={team.role !== "admin"}
              />
            </div>
          </div>

          {/* Team Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-neutral-900">Team Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Private Team</Label>
                  <p className="text-sm text-neutral-500">Only invited members can join</p>
                </div>
                <Switch 
                  checked={formData.isPrivate}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPrivate: checked })}
                  disabled={team.role !== "admin"}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Approval</Label>
                  <p className="text-sm text-neutral-500">Admin must approve new members</p>
                </div>
                <Switch 
                  checked={formData.requiresApproval}
                  onCheckedChange={(checked) => setFormData({ ...formData, requiresApproval: checked })}
                  disabled={team.role !== "admin"}
                />
              </div>
            </div>
          </div>

          {/* Invite Code */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-neutral-900">Invite Code</h3>
            <div className="flex items-center space-x-2">
              <Input
                value={team.inviteCode || "No invite code generated"}
                readOnly
                className="flex-1"
              />
              <Button variant="outline" size="sm">
                <i className="fas fa-copy"></i>
              </Button>
              {team.role === "admin" && (
                <Button variant="outline" size="sm">
                  Regenerate
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-neutral-50 flex justify-end space-x-3">
          <Button 
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          {team.role === "admin" && (
            <Button
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Teams() {
  useScrollToTop();
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showMemberManagement, setShowMemberManagement] = useState(false);
  const [pendingRequestsTab, setPendingRequestsTab] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Check if we're on a specific team detail route
  const [match, params] = useRoute("/teams/:id");
  const teamId = params?.id;

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["/api/teams"],
  });

  // Handle team detail route - automatically open manage modal for specific team
  useEffect(() => {
    if (teamId && (teams as any[]).length > 0) {
      const team = (teams as any[]).find((t: any) => t.id === teamId);
      if (team) {
        setSelectedTeam(team);
        setShowManageModal(true);
      }
    }
  }, [teamId, teams]);

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["/api/teams", selectedTeam?.id, "members"],
    enabled: !!selectedTeam?.id && showMembersModal,
  });

  // Fetch team statistics
  const { data: teamStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["/api/teams", selectedTeam?.id, "stats"],
    enabled: !!selectedTeam?.id && showManageModal,
  });

  // Fetch pending requests
  const { data: pendingRequests = [], isLoading: isPendingLoading } = useQuery({
    queryKey: ["/api/teams", selectedTeam?.id, "pending-requests"],
    enabled: !!selectedTeam?.id && (showMemberManagement || pendingRequestsTab),
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      await apiRequest("DELETE", `/api/teams/${teamId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setShowDeleteModal(false);
      setShowManageModal(false);
      toast({
        title: "Success",
        description: "Team deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete team",
        variant: "destructive",
      });
    },
  });



  // Update team settings mutation
  const updateTeamMutation = useMutation({
    mutationFn: async ({ teamId, updates }: { teamId: string; updates: any }) => {
      await apiRequest("PUT", `/api/teams/${teamId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setShowSettingsModal(false);
      toast({
        title: "Success",
        description: "Team settings updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update team settings",
        variant: "destructive",
      });
    },
  });

  // Search teams functionality
  const searchTeams = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiRequest("GET", `/api/teams/search?q=${encodeURIComponent(query.trim())}`);
      setSearchResults(await response.json());
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      toast({
        title: "Error",
        description: "Failed to search teams",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Join team mutation
  const joinTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const response = await apiRequest("POST", `/api/teams/${teamId}/request-join`);
      return response;
    },
    onSuccess: async (response) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({
        title: "Success",
        description: data.message || "Successfully joined team",
      });
      setShowSearchModal(false);
      setSearchQuery("");
      setSearchResults([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join team",
        variant: "destructive",
      });
    },
  });

  // Leave team mutation
  const leaveTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      await apiRequest("POST", `/api/teams/${teamId}/leave`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setShowManageModal(false);
      toast({
        title: "Success",
        description: "You have left the team successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to leave team",
        variant: "destructive",
      });
    },
  });

  const handleLeaveTeam = (teamId: string) => {
    if (confirm("Are you sure you want to leave this team? This action cannot be undone.")) {
      leaveTeamMutation.mutate(teamId);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">Teams</h1>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="flex items-center justify-center space-x-2"
              >
                <i className="fas fa-plus"></i>
                <span>Create Team</span>
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowSearchModal(true)}
                className="flex items-center justify-center space-x-2"
              >
                <i className="fas fa-search"></i>
                <span>Find teams</span>
              </Button>
            </div>
          </div>
        </div>

        {showCreateForm && (
          <div className="mb-8">
            <TeamForm 
              onCancel={() => setShowCreateForm(false)}
              onSuccess={() => setShowCreateForm(false)}
            />
          </div>
        )}

        {/* Team Grid */}
        {(teams as any[]).length === 0 ? (
          <div className="text-center py-12">
              <i className="fas fa-users text-neutral-300 text-6xl mb-4"></i>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">No teams yet</h3>
              <p className="text-neutral-500 mb-4">Create your first team to get started</p>
              <Button onClick={() => setShowCreateForm(true)}>
                Create Team
              </Button>
            </div>
          ) : (
            <Carousel className="w-full mb-12">
              <CarouselContent className="snap-x snap-mandatory">
                {(teams as any[]).map((team: any) => (
                  <CarouselItem key={team.id}>
                    <Card className="overflow-hidden">
                <div className="h-32 relative">
                  {team.teamImagePath ? (
                    <img 
                      src={team.teamImagePath}
                      alt={`${team.name} team image`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-center"
                      style={{ 
                        background: `linear-gradient(135deg, ${team.color || '#3b82f6'}, ${team.color || '#3b82f6'}dd)` 
                      }}
                    >
                      {(() => {
                        const IconComponent = getSportIcon(team.sports?.[0] || '');
                        return <IconComponent className="text-white w-16 h-16 opacity-50" />;
                      })()}
                    </div>
                  )}
                  
                  {/* Upload button for team owners */}
                  {team.isOwner && (
                    <div className="absolute top-4 left-4">
                      <ObjectUploader
                        maxNumberOfFiles={1}
                        maxFileSize={5242880} // 5MB
                        onGetUploadParameters={async () => {
                          try {
                            console.log('Requesting upload URL...');
                            const response = await apiRequest('POST', '/api/objects/upload');
                            console.log('Raw response:', response);
                            const data = await response.json();
                            console.log('Parsed upload response:', data);
                            console.log('Upload URL:', data.uploadURL);
                            if (!data.uploadURL) {
                              throw new Error('No upload URL received');
                            }
                            const result = {
                              method: 'PUT' as const,
                              url: data.uploadURL,
                            };
                            console.log('Returning to Uppy:', result);
                            return result;
                          } catch (error) {
                            console.error('Error getting upload parameters:', error);
                            throw error;
                          }
                        }}
                        onComplete={async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
                          if (result.successful && result.successful.length > 0) {
                            const uploadedFile = result.successful[0];
                            console.log('Upload result:', uploadedFile);
                            try {
                              const updateResponse = await apiRequest('PUT', `/api/teams/${team.id}/image`, { imageURL: uploadedFile.uploadURL });
                              const updateData = await updateResponse.json();
                              console.log('Image update response:', updateData);
                              
                              // Refresh teams data
                              queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
                              toast({ title: "Team image updated successfully!" });
                            } catch (error) {
                              console.error('Error updating team image:', error);
                              toast({ 
                                title: "Error updating team image", 
                                description: "Please try again.",
                                variant: "destructive" 
                              });
                            }
                          }
                        }}
                        buttonClassName="bg-black/20 hover:bg-black/40 text-white border-white/30 text-xs"
                      >
                        <i className="fas fa-camera mr-1"></i>
                        Upload
                      </ObjectUploader>
                    </div>
                  )}
                  
                  <div className="absolute top-4 right-4">
                    <Badge variant={
                      team.isOwner ? "default" :
                      team.role === "admin" ? "secondary" :
                      team.role === "captain" ? "secondary" :
                      "outline"
                    } className={
                      team.isOwner ? "bg-yellow-100 text-yellow-800" :
                      team.role === "admin" ? "bg-blue-100 text-blue-800" :
                      team.role === "captain" ? "bg-green-100 text-green-800" :
                      ""
                    }>
                      {team.isOwner ? "Owner" : team.role === "captain" ? "Captain" : team.role}
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: team.color || '#3b82f6' }}
                    >
                      {(() => {
                        const IconComponent = getSportIcon(team.sports?.[0] || '');
                        return <IconComponent className="w-6 h-6 text-white" />;
                      })()}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900">{team.name}</h3>
                      <p className="text-sm text-neutral-500">
                        {team.sports && team.sports.length > 0 ? team.sports.join(', ') : 'No sports set'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Members:</span>
                      <span className="font-medium text-neutral-900">
                        {team.maxPlayers ? `${team.memberCount}/${team.maxPlayers}` : team.memberCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Status:</span>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedTeam(team);
                        setShowManageModal(true);
                      }}
                    >
                      {team.role === "admin" ? "Manage" : "View"}
                    </Button>
                    <Link href={`/events?team=${team.id}`}>
                      <Button size="sm" variant="outline" className="w-full">
                        Events
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>
        )}

        {/* Team Creation Form */}
        {showCreateForm && (
          <TeamForm 
            onCancel={() => setShowCreateForm(false)}
            onSuccess={() => setShowCreateForm(false)}
          />
        )}

        {/* Team Management Modal */}
        {showManageModal && selectedTeam && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div 
                className="p-6 border-b relative"
                style={{ 
                  background: `linear-gradient(135deg, ${selectedTeam.color || '#3b82f6'}, ${selectedTeam.color || '#3b82f6'}dd)` 
                }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">
                    Manage {selectedTeam.name}
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowManageModal(false)}
                    className="text-white hover:bg-white/20"
                  >
                    <i className="fas fa-times"></i>
                  </Button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Team Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-500">Team Name</label>
                    <p className="text-neutral-900">{selectedTeam.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-500">Sport</label>
                    <p className="text-neutral-900">{selectedTeam.sport}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-500">Members</label>
                    <p className="text-neutral-900">{selectedTeam.memberCount}/{selectedTeam.maxPlayers || "No limit"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-500">Your Role</label>
                    <Badge variant="secondary">{selectedTeam.role}</Badge>
                  </div>
                </div>

                {/* Management Actions */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-neutral-900">Management Actions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      variant="outline" 
                      className="flex items-center space-x-2"
                      onClick={() => setShowMembersModal(true)}
                    >
                      <i className="fas fa-users"></i>
                      <span>View Members</span>
                    </Button>
                    {(selectedTeam.isOwner || selectedTeam.role === "admin") && (
                      <Button 
                        variant="outline" 
                        className="flex items-center space-x-2"
                        onClick={() => setShowMemberManagement(true)}
                      >
                        <i className="fas fa-user-cog"></i>
                        <span>Manage Members</span>
                      </Button>
                    )}
                    <Link href={`/events?team=${selectedTeam.id}`}>
                      <Button variant="outline" className="flex items-center space-x-2 w-full">
                        <i className="fas fa-calendar"></i>
                        <span>Team Events</span>
                      </Button>
                    </Link>
                    {!selectedTeam.isOwner && (
                      <Button 
                        variant="destructive" 
                        className="flex items-center space-x-2"
                        onClick={() => handleLeaveTeam(selectedTeam.id)}
                      >
                        <i className="fas fa-sign-out-alt"></i>
                        <span>Leave Team</span>
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      className="flex items-center space-x-2"
                      onClick={() => setShowSettingsModal(true)}
                    >
                      <i className="fas fa-cog"></i>
                      <span>Settings</span>
                    </Button>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-neutral-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-neutral-900 mb-3">Quick Stats</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {isStatsLoading ? "..." : (teamStats as any)?.eventsThisMonth || 0}
                      </p>
                      <p className="text-xs text-neutral-500">Events This Month</p>
                    </div>
                    <div
                      className="cursor-pointer hover:bg-neutral-100 rounded-lg p-2 transition-colors"
                      onClick={() => {
                        if ((teamStats as any)?.pendingRequests && (teamStats as any).pendingRequests > 0) {
                          setPendingRequestsTab(true);
                          setShowMemberManagement(true);
                        }
                      }}
                    >
                      <p className="text-2xl font-bold text-secondary">
                        {isStatsLoading ? "..." : (teamStats as any)?.pendingRequests || 0}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Pending Requests {(teamStats as any)?.pendingRequests && (teamStats as any).pendingRequests > 0 ? "(Click to view)" : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-accent">Active</p>
                      <p className="text-xs text-neutral-500">Team Status</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-neutral-50 flex justify-end space-x-3">
                <Button 
                  variant="outline"
                  onClick={() => setShowManageModal(false)}
                >
                  Close
                </Button>
                {selectedTeam.role === "admin" && (
                  <Button 
                    variant="destructive"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    <i className="fas fa-trash mr-2"></i>
                    Delete Team
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}



        {/* View Members Modal */}
        {showMembersModal && selectedTeam && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-neutral-900">
                    {selectedTeam.name} Members
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowMembersModal(false)}
                  >
                    <i className="fas fa-times"></i>
                  </Button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {(teamMembers as any[]).length === 0 ? (
                    <div className="text-center py-8">
                      <i className="fas fa-users text-neutral-300 text-4xl mb-4"></i>
                      <h3 className="text-lg font-medium text-neutral-900 mb-2">No members yet</h3>
                      <p className="text-neutral-500">Invite members to start building your team</p>
                    </div>
                  ) : (
                    (teamMembers as any[]).map((membership: any) => (
                      <div key={membership.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-white font-medium">
                              {membership.user.firstName?.[0] || membership.user.username?.[0]?.toUpperCase() || membership.user.email?.[0]?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-medium text-neutral-900">
                              {membership.user.firstName && membership.user.lastName 
                                ? `${membership.user.firstName} ${membership.user.lastName}` 
                                : membership.user.username || membership.user.email
                              }
                            </h4>
                            {membership.user.username && (membership.user.firstName || membership.user.lastName) && (
                              <p className="text-sm text-neutral-500">@{membership.user.username}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={
                            (selectedTeam?.ownerId === membership.user.id) ? "default" :
                            membership.role === "admin" ? "default" :
                            membership.role === "captain" ? "secondary" :
                            "outline"
                          }>
                            {selectedTeam?.ownerId === membership.user.id ? "Owner" : 
                             membership.role === "admin" ? "Admin" : 
                             membership.role === "captain" ? "Captain" : "Member"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-6 border-t bg-neutral-50 flex justify-end">
                <Button onClick={() => setShowMembersModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Team Settings Modal */}
        {showSettingsModal && selectedTeam && (
          <TeamSettingsModal 
            team={selectedTeam}
            onClose={() => setShowSettingsModal(false)}
            onSave={(updates) => updateTeamMutation.mutate({ teamId: selectedTeam.id, updates })}
            isLoading={updateTeamMutation.isPending}
          />
        )}

        {/* Delete Team Confirmation Modal */}
        {showDeleteModal && selectedTeam && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold text-red-600">
                  Delete Team
                </h2>
              </div>
              
              <div className="p-6">
                <p className="text-neutral-700 mb-4">
                  Are you sure you want to delete <strong>{selectedTeam.name}</strong>? 
                  This action cannot be undone.
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-2">This will permanently:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    <li>• Remove all team members</li>
                    <li>• Delete all team events</li>
                    <li>• Remove all team data</li>
                  </ul>
                </div>
              </div>

              <div className="p-6 border-t bg-neutral-50 flex justify-end space-x-3">
                <Button 
                  variant="outline"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => deleteTeamMutation.mutate(selectedTeam.id)}
                  disabled={deleteTeamMutation.isPending}
                >
                  {deleteTeamMutation.isPending ? "Deleting..." : "Delete Team"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Search Teams Modal */}
        {showSearchModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-neutral-900">
                    Search Teams
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setShowSearchModal(false);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                  >
                    <i className="fas fa-times"></i>
                  </Button>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <Label htmlFor="searchInput">Team Name</Label>
                  <Input
                    id="searchInput"
                    type="text"
                    placeholder="Enter team name to search..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      searchTeams(e.target.value);
                    }}
                    className="mt-1"
                  />
                </div>

                {isSearching && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
                    <span className="ml-2 text-neutral-600">Searching...</span>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-medium text-neutral-900">Search Results</h3>
                    {searchResults.map((team: any) => (
                      <div key={team.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div 
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: team.color || '#3b82f6' }}
                          >
                            {team.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-medium text-neutral-900">{team.name}</h4>
                            <p className="text-sm text-neutral-500">
                              {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                            </p>
                            {team.sports && team.sports.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {team.sports.slice(0, 3).map((sport: string) => (
                                  <Badge key={sport} variant="outline" className="text-xs">
                                    {sport}
                                  </Badge>
                                ))}
                                {team.sports.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{team.sports.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {team.isMember ? (
                            <Badge variant="secondary">Member</Badge>
                          ) : (
                            <Button 
                              size="sm"
                              onClick={() => joinTeamMutation.mutate(team.id)}
                              disabled={joinTeamMutation.isPending}
                            >
                              {team.requiresApproval ? "Request to Join" : "Join Team"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                  <div className="text-center py-8">
                    <i className="fas fa-search text-neutral-300 text-4xl mb-4"></i>
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No teams found</h3>
                    <p className="text-neutral-500">Try searching with different keywords</p>
                  </div>
                )}

                {searchQuery.length < 2 && (
                  <div className="text-center py-8">
                    <i className="fas fa-search text-neutral-300 text-4xl mb-4"></i>
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">Search for teams</h3>
                    <p className="text-neutral-500">Enter at least 2 characters to search</p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t bg-neutral-50 flex justify-end">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setShowSearchModal(false);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Member Management Modal */}
        {showMemberManagement && selectedTeam && (
          <MemberManagementModal
            isOpen={showMemberManagement}
            onClose={() => {
              setShowMemberManagement(false);
              setPendingRequestsTab(false);
            }}
            teamId={selectedTeam.id}
            teamName={selectedTeam.name}
            isOwner={selectedTeam.isOwner || false}
            isAdmin={selectedTeam.role === 'admin' || selectedTeam.isOwner}
            initialTab={pendingRequestsTab ? "pending" : "members"}
            pendingRequests={pendingRequests as any[]}
          />
        )}
      </main>
    </div>
  );
}
