/**
 * Phase 25: Rule Engine
 * Processes upload context through rules to determine document handling
 */

import {
  UploadContext,
  ResolvedUploadConfig,
  EntityLink,
} from './types';
import { DocumentCategory, StorageProviderType } from '../types';
import { resolveStorageProvider, StorageRules } from './rules/StorageRules';
import { resolveCategory, CategoryRules } from './rules/CategoryRules';
import { resolveLinks, LinkingRules } from './rules/LinkingRules';
import { resolveStoragePath, PathRules } from './rules/PathRules';

export class RuleEngine {
  /**
   * Resolve all rules for an upload context
   */
  async resolve(context: UploadContext): Promise<ResolvedUploadConfig> {
    console.log('[RuleEngine] Resolving configuration for:', {
      source: context.source,
      filename: context.filename,
      entities: context.entities,
      userInput: context.userInput,
    });

    // Step 1: Resolve storage provider
    const storageProvider = await this.applyStorageRules(context);
    console.log('[RuleEngine] Storage provider:', storageProvider);

    // Step 2: Resolve document category
    const category = await this.applyCategoryRules(context);
    console.log('[RuleEngine] Category:', category);

    // Step 3: Resolve entity links
    const links = await this.applyLinkingRules(context);
    console.log('[RuleEngine] Links:', links.length, links.map(l => `${l.entityType}:${l.entityId}`));

    // Step 4: Resolve storage path
    const storagePath = this.applyPathRules(context, links);
    console.log('[RuleEngine] Storage path:', storagePath);

    // Step 5: Generate suggested tags
    const suggestedTags = this.generateSuggestedTags(context, category, links);

    return {
      storageProvider,
      storagePath,
      category,
      suggestedTags,
      links,
    };
  }

  /**
   * Apply storage rules
   */
  private async applyStorageRules(context: UploadContext): Promise<StorageProviderType> {
    const sortedRules = [...StorageRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const matches = await Promise.resolve(rule.matches(context));
      if (matches) {
        console.log(`[RuleEngine] Storage rule matched: ${rule.name}`);
        return rule.getProvider(context);
      }
    }

    return StorageProviderType.MONITRAX;
  }

  /**
   * Apply category rules
   */
  private async applyCategoryRules(context: UploadContext): Promise<DocumentCategory> {
    const sortedRules = [...CategoryRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const matches = await Promise.resolve(rule.matches(context));
      if (matches) {
        console.log(`[RuleEngine] Category rule matched: ${rule.name}`);
        return rule.getCategory(context);
      }
    }

    return DocumentCategory.OTHER;
  }

  /**
   * Apply linking rules
   */
  private async applyLinkingRules(context: UploadContext): Promise<EntityLink[]> {
    const allLinks: EntityLink[] = [];
    const sortedRules = [...LinkingRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (rule.matches(context)) {
        console.log(`[RuleEngine] Linking rule matched: ${rule.name}`);
        const links = await rule.getLinks(context);
        allLinks.push(...links);
      }
    }

    // Deduplicate links
    return this.deduplicateLinks(allLinks);
  }

  /**
   * Apply path rules
   */
  private applyPathRules(context: UploadContext, links: EntityLink[]): string {
    const sortedRules = [...PathRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (rule.matches(context, links)) {
        console.log(`[RuleEngine] Path rule matched: ${rule.name}`);
        return rule.generatePath(context, links);
      }
    }

    // Fallback path
    return `${context.userId}/documents/${Date.now()}_${context.filename}`;
  }

  /**
   * Generate suggested tags based on resolved configuration
   */
  private generateSuggestedTags(
    context: UploadContext,
    category: DocumentCategory,
    links: EntityLink[]
  ): string[] {
    const tags: string[] = [];

    // Add user-specified tags first
    if (context.userInput?.tags?.length) {
      tags.push(...context.userInput.tags);
    }

    // Add category as tag
    tags.push(category.toLowerCase().replace(/_/g, '-'));

    // Add source as tag
    const sourceTag = context.source.replace(/_/g, '-');
    if (!tags.includes(sourceTag)) {
      tags.push(sourceTag);
    }

    // Add entity types as tags
    for (const link of links) {
      const entityTag = link.entityType.toLowerCase().replace(/_/g, '-');
      if (!tags.includes(entityTag)) {
        tags.push(entityTag);
      }
    }

    // Deduplicate and return
    return [...new Set(tags)];
  }

  /**
   * Remove duplicate links
   */
  private deduplicateLinks(links: EntityLink[]): EntityLink[] {
    const seen = new Set<string>();
    return links.filter(link => {
      const key = `${link.entityType}:${link.entityId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Preview what the engine would do (for debugging/testing)
   */
  async preview(context: UploadContext): Promise<{
    rules: {
      storage: string | null;
      category: string | null;
      linking: string[];
      path: string | null;
    };
    config: ResolvedUploadConfig;
  }> {
    const matchedRules = {
      storage: null as string | null,
      category: null as string | null,
      linking: [] as string[],
      path: null as string | null,
    };

    // Find matched storage rule
    for (const rule of [...StorageRules].sort((a, b) => b.priority - a.priority)) {
      if (await Promise.resolve(rule.matches(context))) {
        matchedRules.storage = rule.name;
        break;
      }
    }

    // Find matched category rule
    for (const rule of [...CategoryRules].sort((a, b) => b.priority - a.priority)) {
      if (await Promise.resolve(rule.matches(context))) {
        matchedRules.category = rule.name;
        break;
      }
    }

    // Find all matched linking rules
    for (const rule of LinkingRules) {
      if (rule.matches(context)) {
        matchedRules.linking.push(rule.name);
      }
    }

    // Get full resolution
    const config = await this.resolve(context);

    // Find matched path rule
    for (const rule of [...PathRules].sort((a, b) => b.priority - a.priority)) {
      if (rule.matches(context, config.links)) {
        matchedRules.path = rule.name;
        break;
      }
    }

    return {
      rules: matchedRules,
      config,
    };
  }
}

// Export singleton instance
let ruleEngineInstance: RuleEngine | null = null;

export function getRuleEngine(): RuleEngine {
  if (!ruleEngineInstance) {
    ruleEngineInstance = new RuleEngine();
  }
  return ruleEngineInstance;
}
