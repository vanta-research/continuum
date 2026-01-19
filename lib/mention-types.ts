/**
 * Types for the @mention document feature
 */

/**
 * A document that has been mentioned/selected by the user
 */
export interface DocumentMention {
  id: string;
  title: string;
  content: string;
}

/**
 * State for the mention popover
 */
export interface MentionState {
  /** Whether the popover is visible */
  isOpen: boolean;
  /** The search query (text after @) */
  query: string;
  /** Currently selected index in the list */
  selectedIndex: number;
  /** Position of the @ trigger in the textarea */
  triggerIndex: number;
}

/**
 * Initial mention state
 */
export const initialMentionState: MentionState = {
  isOpen: false,
  query: "",
  selectedIndex: 0,
  triggerIndex: -1,
};

/**
 * Document sent to API for context
 */
export interface MentionedDocumentPayload {
  id: string;
  title: string;
  content: string;
}
