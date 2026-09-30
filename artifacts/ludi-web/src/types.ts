import type { User, EventAttendance, PlatformCharge } from "@workspace/db/schema";

export type { PlatformCharge };

export interface TeamMember {
  userId: string;
  user: User;
  role: string;
}

export type AttendanceRecord = EventAttendance & { user: User };
