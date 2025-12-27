/**
 * OutlinerEvents.ts - Event system for World Outliner
 * 
 * Path: frontend/src/systems/outliner/OutlinerEvents.ts
 * 
 * Provides a typed event emitter for outliner events,
 * allowing other systems to react to hierarchy changes,
 * selection changes, visibility toggles, etc.
 * 
 * @module OutlinerEvents
 */

import type {
    OutlinerEvent,
    OutlinerEventType,
    OutlinerEventListener,
    NodeCreatedEvent,
    NodeDeletedEvent,
    NodeRenamedEvent,
    NodeMovedEvent,
    NodeVisibilityChangedEvent,
    NodeLockChangedEvent,
    NodeExpandedChangedEvent,
    NodeSelectedEvent,
    NodeDeselectedEvent,
    SelectionChangedEvent,
    NodeDuplicatedEvent,
    HierarchyChangedEvent,
    OutlinerNodeType,
} from '../../types/outliner.types';

// ============================================================================
// EVENT EMITTER CLASS
// ============================================================================

/**
 * OutlinerEventEmitter - Typed event system for the World Outliner
 * 
 * Supports:
 * - Type-safe event emission and listening
 * - Wildcard listeners for all events
 * - One-time listeners
 * - Listener removal
 * 
 * @example
 * ```typescript
 * const events = new OutlinerEventEmitter();
 * 
 * // Listen for specific event
 * events.on('node:created', (event) => {
 *     console.log('Node created:', event.nodeId);
 * });
 * 
 * // Listen for all events
 * events.onAny((event) => {
 *     console.log('Event:', event.type);
 * });
 * 
 * // Emit an event
 * events.emitNodeCreated('node_123', 'folder', null);
 * ```
 */
export class OutlinerEventEmitter {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Listeners for specific event types */
    private listeners: Map<OutlinerEventType, Set<OutlinerEventListener>>;

    /** Listeners for all events */
    private wildcardListeners: Set<OutlinerEventListener>;

    /** One-time listeners */
    private onceListeners: Map<OutlinerEventType, Set<OutlinerEventListener>>;

    /** Whether to log events to console */
    private debugMode: boolean;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new event emitter
     * @param debugMode - Whether to log events to console
     */
    constructor(debugMode: boolean = false) {
        this.listeners = new Map();
        this.wildcardListeners = new Set();
        this.onceListeners = new Map();
        this.debugMode = debugMode;

        console.log('[OutlinerEvents] Event emitter created');
    }

    // ========================================================================
    // LISTENER REGISTRATION
    // ========================================================================

    /**
     * Add a listener for a specific event type
     * @param eventType - Type of event to listen for
     * @param listener - Callback function
     * @returns Unsubscribe function
     */
    on<T extends OutlinerEventType>(
        eventType: T,
        listener: OutlinerEventListener
    ): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }

        this.listeners.get(eventType)!.add(listener);

        // Return unsubscribe function
        return () => this.off(eventType, listener);
    }

    /**
     * Add a one-time listener that removes itself after first call
     * @param eventType - Type of event to listen for
     * @param listener - Callback function
     * @returns Unsubscribe function
     */
    once<T extends OutlinerEventType>(
        eventType: T,
        listener: OutlinerEventListener
    ): () => void {
        if (!this.onceListeners.has(eventType)) {
            this.onceListeners.set(eventType, new Set());
        }

        this.onceListeners.get(eventType)!.add(listener);

        return () => {
            const listeners = this.onceListeners.get(eventType);
            if (listeners) {
                listeners.delete(listener);
            }
        };
    }

    /**
     * Add a listener for all events
     * @param listener - Callback function
     * @returns Unsubscribe function
     */
    onAny(listener: OutlinerEventListener): () => void {
        this.wildcardListeners.add(listener);
        return () => this.wildcardListeners.delete(listener);
    }

    /**
     * Remove a listener for a specific event type
     * @param eventType - Type of event
     * @param listener - Callback to remove
     */
    off(eventType: OutlinerEventType, listener: OutlinerEventListener): void {
        const listeners = this.listeners.get(eventType);
        if (listeners) {
            listeners.delete(listener);
        }

        const onceListeners = this.onceListeners.get(eventType);
        if (onceListeners) {
            onceListeners.delete(listener);
        }
    }

    /**
     * Remove all listeners for a specific event type
     * @param eventType - Type of event
     */
    offAll(eventType: OutlinerEventType): void {
        this.listeners.delete(eventType);
        this.onceListeners.delete(eventType);
    }

    /**
     * Remove all listeners
     */
    clear(): void {
        this.listeners.clear();
        this.wildcardListeners.clear();
        this.onceListeners.clear();
        console.log('[OutlinerEvents] All listeners cleared');
    }

    // ========================================================================
    // EVENT EMISSION
    // ========================================================================

    /**
     * Emit an event to all listeners
     * @param event - Event object to emit
     */
    private emit(event: OutlinerEvent): void {
        if (this.debugMode) {
            console.log(`[OutlinerEvents] Emit: ${event.type}`, event);
        }

        // Notify specific listeners
        const listeners = this.listeners.get(event.type);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event);
                } catch (error) {
                    console.error(`[OutlinerEvents] Listener error for ${event.type}:`, error);
                }
            });
        }

        // Notify one-time listeners
        const onceListeners = this.onceListeners.get(event.type);
        if (onceListeners && onceListeners.size > 0) {
            const listenersToCall = [...onceListeners];
            onceListeners.clear();
            listenersToCall.forEach(listener => {
                try {
                    listener(event);
                } catch (error) {
                    console.error(`[OutlinerEvents] Once listener error for ${event.type}:`, error);
                }
            });
        }

        // Notify wildcard listeners
        this.wildcardListeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('[OutlinerEvents] Wildcard listener error:', error);
            }
        });
    }

    // ========================================================================
    // TYPED EMIT METHODS
    // ========================================================================

    /**
     * Emit a node created event
     */
    emitNodeCreated(
        nodeId: string,
        nodeType: OutlinerNodeType,
        parentId: string | null
    ): void {
        const event: NodeCreatedEvent = {
            type: 'node:created',
            timestamp: Date.now(),
            nodeId,
            nodeType,
            parentId,
        };
        this.emit(event);
    }

    /**
     * Emit a node deleted event
     */
    emitNodeDeleted(
        nodeId: string,
        nodeType: OutlinerNodeType,
        parentId: string | null,
        deletedDescendantIds: string[]
    ): void {
        const event: NodeDeletedEvent = {
            type: 'node:deleted',
            timestamp: Date.now(),
            nodeId,
            nodeType,
            parentId,
            deletedDescendantIds,
        };
        this.emit(event);
    }

    /**
     * Emit a node renamed event
     */
    emitNodeRenamed(
        nodeId: string,
        oldName: string,
        newName: string
    ): void {
        const event: NodeRenamedEvent = {
            type: 'node:renamed',
            timestamp: Date.now(),
            nodeId,
            oldName,
            newName,
        };
        this.emit(event);
    }

    /**
     * Emit a node moved event
     */
    emitNodeMoved(
        nodeId: string,
        oldParentId: string | null,
        newParentId: string | null,
        oldSortOrder: number,
        newSortOrder: number
    ): void {
        const event: NodeMovedEvent = {
            type: 'node:moved',
            timestamp: Date.now(),
            nodeId,
            oldParentId,
            newParentId,
            oldSortOrder,
            newSortOrder,
        };
        this.emit(event);
    }

    /**
     * Emit a node visibility changed event
     */
    emitNodeVisibilityChanged(
        nodeId: string,
        visible: boolean,
        affectedDescendantIds: string[]
    ): void {
        const event: NodeVisibilityChangedEvent = {
            type: 'node:visibility_changed',
            timestamp: Date.now(),
            nodeId,
            visible,
            affectedDescendantIds,
        };
        this.emit(event);
    }

    /**
     * Emit a node lock changed event
     */
    emitNodeLockChanged(nodeId: string, locked: boolean): void {
        const event: NodeLockChangedEvent = {
            type: 'node:lock_changed',
            timestamp: Date.now(),
            nodeId,
            locked,
        };
        this.emit(event);
    }

    /**
     * Emit a node expanded changed event
     */
    emitNodeExpandedChanged(nodeId: string, expanded: boolean): void {
        const event: NodeExpandedChangedEvent = {
            type: 'node:expanded_changed',
            timestamp: Date.now(),
            nodeId,
            expanded,
        };
        this.emit(event);
    }

    /**
     * Emit a node selected event
     */
    emitNodeSelected(nodeId: string, additive: boolean): void {
        const event: NodeSelectedEvent = {
            type: 'node:selected',
            timestamp: Date.now(),
            nodeId,
            additive,
        };
        this.emit(event);
    }

    /**
     * Emit a node deselected event
     */
    emitNodeDeselected(nodeId: string): void {
        const event: NodeDeselectedEvent = {
            type: 'node:deselected',
            timestamp: Date.now(),
            nodeId,
        };
        this.emit(event);
    }

    /**
     * Emit a selection changed event
     */
    emitSelectionChanged(
        selectedIds: string[],
        previousSelectedIds: string[]
    ): void {
        const event: SelectionChangedEvent = {
            type: 'selection:changed',
            timestamp: Date.now(),
            selectedIds,
            previousSelectedIds,
        };
        this.emit(event);
    }

    /**
     * Emit a node duplicated event
     */
    emitNodeDuplicated(
        sourceNodeId: string,
        newNodeId: string,
        descendantIdMap: Record<string, string>
    ): void {
        const event: NodeDuplicatedEvent = {
            type: 'node:duplicated',
            timestamp: Date.now(),
            sourceNodeId,
            newNodeId,
            descendantIdMap,
        };
        this.emit(event);
    }

    /**
     * Emit a hierarchy changed event
     */
    emitHierarchyChanged(affectedNodeIds: string[]): void {
        const event: HierarchyChangedEvent = {
            type: 'hierarchy:changed',
            timestamp: Date.now(),
            affectedNodeIds,
        };
        this.emit(event);
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Get the number of listeners for an event type
     * @param eventType - Type of event
     * @returns Number of listeners
     */
    listenerCount(eventType: OutlinerEventType): number {
        const specific = this.listeners.get(eventType)?.size ?? 0;
        const once = this.onceListeners.get(eventType)?.size ?? 0;
        return specific + once + this.wildcardListeners.size;
    }

    /**
     * Check if there are any listeners for an event type
     * @param eventType - Type of event
     * @returns True if there are listeners
     */
    hasListeners(eventType: OutlinerEventType): boolean {
        return this.listenerCount(eventType) > 0;
    }

    /**
     * Enable or disable debug mode
     * @param enabled - Whether to enable debug logging
     */
    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
        console.log(`[OutlinerEvents] Debug mode: ${enabled}`);
    }

    /**
     * Get debug mode state
     * @returns Whether debug mode is enabled
     */
    isDebugMode(): boolean {
        return this.debugMode;
    }
}

// ============================================================================
// SINGLETON INSTANCE (optional usage)
// ============================================================================

/**
 * Default shared event emitter instance
 * Use this for application-wide event handling
 */
let sharedEmitter: OutlinerEventEmitter | null = null;

/**
 * Get the shared event emitter instance
 * @returns Shared OutlinerEventEmitter
 */
export function getSharedOutlinerEvents(): OutlinerEventEmitter {
    if (!sharedEmitter) {
        sharedEmitter = new OutlinerEventEmitter();
    }
    return sharedEmitter;
}

/**
 * Reset the shared event emitter (for testing)
 */
export function resetSharedOutlinerEvents(): void {
    if (sharedEmitter) {
        sharedEmitter.clear();
        sharedEmitter = null;
    }
}