// All UI copy in one place (SPEC §7, A1). No i18n library — a future Bahasa swap edits
// this file only.

export const strings = {
  appName: "Purrfect Log",
  tagline: "Family cat care",

  nav: {
    today: "Today",
    care: "Care",
    journal: "Journal",
    catalog: "Catalog",
    settings: "Settings",
  },

  auth: {
    signInTitle: "Sign in to Purrfect Log",
    signInSubtitle: "We'll email you a magic link — no password needed.",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    sendLink: "Send magic link",
    sending: "Sending…",
    linkSent: "Check your email",
    linkSentBody: (email: string) =>
      `We sent a sign-in link to ${email}. Open it on this device.`,
    signOut: "Sign out",
    notMemberTitle: "You're not on the list",
    notMemberBody:
      "This household app is invite-only. Ask an existing member to add your email in Settings, then sign in again.",
    backToSignIn: "Back to sign in",
    genericError: "Something went wrong. Please try again.",
  },

  today: {
    title: "Today",
    feedAll: "Feed all",
    quickLog: "Quick log",
    lastFed: "Last fed",
    noFeedsYet: "No feeds logged today",
    logWeightNudge: "Log a weight to unlock calorie targets",
    of: "of",
    kcal: "kcal",
    water: "Water",
    overdue: "Overdue",
    dueToday: "Due today",
    treatWarning: "Over treat limit",
  },

  feed: {
    title: "Log feed",
    pickCat: "Who's eating?",
    pickFood: "What?",
    amount: "How much?",
    grams: "grams",
    portion: "portion",
    custom: "Custom",
    preview: "≈",
    save: "Save feed",
    saved: "Feed logged",
    treatToast: "Heads up — over today's treat limit for this cat.",
  },

  care: {
    title: "Care",
    overdue: "Overdue",
    dueToday: "Due today",
    upcoming: "Upcoming",
    complete: "Done",
    reschedule: "Reschedule",
    newEvent: "New event",
    newCourse: "New med course",
    noneOpen: "Nothing due. All caught up.",
  },

  journal: {
    title: "Journal",
    allCats: "All cats",
    empty: "No observations yet.",
  },

  common: {
    save: "Save",
    cancel: "Cancel",
    add: "Add",
    edit: "Edit",
    delete: "Remove",
    deactivate: "Deactivate",
    activate: "Activate",
    loading: "Loading…",
    none: "None",
    optional: "optional",
    photo: "Photo",
    notes: "Notes",
    by: "by",
  },
} as const;
