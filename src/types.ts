import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'editor' | 'user';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
}

export interface ReflectionEntry {
  question: string;
  answer: string;
}

export interface Reflection {
  id: string;
  verseRef: string;
  entries: ReflectionEntry[];
  question?: string;
  content?: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
  isPublic: boolean;
}
