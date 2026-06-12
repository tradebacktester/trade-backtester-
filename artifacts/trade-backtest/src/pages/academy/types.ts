export interface AcademyCourse {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  pathId: string;
  thumbnailEmoji: string;
  estimatedMinutes: number;
  sortOrder: number;
  published: boolean;
  lessonCount?: number;
  completedLessons?: number;
  quizScore?: number | null;
}

export interface AcademyLesson {
  id: number;
  courseId: number;
  title: string;
  type: string;
  content: string;
  videoUrl?: string | null;
  imageUrls?: string[];
  estimatedMinutes: number;
  sortOrder: number;
  completed?: boolean;
}

export interface AcademyQuizQuestion {
  id: number;
  courseId: number;
  question: string;
  type: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sortOrder: number;
}

export interface AcademyQuizAttempt {
  id: number;
  courseId: number;
  score: number;
  totalQuestions: number;
  answers: number[];
  timeSpentSeconds: number;
  completedAt: string;
}

export interface AcademyNote {
  id: number;
  title: string;
  content: string;
  tags: string[];
  isShared: boolean;
  lessonId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcademyCertificate {
  id: number;
  pathId: string;
  score: number;
  issuedAt: string;
}

export interface AcademyXp {
  xp: number;
  level: number;
  badges: string[];
  streakDays: number;
  longestStreak: number;
  totalStudyMinutes: number;
}

export interface AcademyDashboard {
  xp: AcademyXp;
  totalLessonsCompleted: number;
  totalStudyMinutes: number;
  quizAccuracy: number;
  notesCreated: number;
  certificatesEarned: number;
  pathProgress: Record<string, { total: number; completed: number; quizScore: number | null }>;
  recentActivity: Array<{ type: string; title: string; time: string }>;
  lastLesson: { id: number; title: string; courseTitle: string } | null;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  courses: AcademyCourse[];
  totalLessons: number;
  completedLessons: number;
  locked: boolean;
  estimatedHours: number;
}

export const PATH_META: Record<string, { title: string; description: string; icon: string; color: string; unlockRequirement?: string }> = {
  beginner: {
    title: "Beginner Trader",
    description: "Master the fundamentals of trading from scratch",
    icon: "🥉",
    color: "#22c55e",
  },
  intermediate: {
    title: "Intermediate Trader",
    description: "Deepen your skills with advanced price action",
    icon: "🥈",
    color: "#06b6d4",
  },
  advanced: {
    title: "Advanced Trader",
    description: "Smart money concepts and institutional techniques",
    icon: "🥇",
    color: "#a855f7",
  },
  professional: {
    title: "Professional Trader",
    description: "Portfolio management and systematic trading",
    icon: "🏆",
    color: "#f59e0b",
  },
};
