/*
<MODULE_CONTRACT>
<purpose>Resolves or creates record identities on refresh by matching against existing keys and aliases, detecting renames.</purpose>
<non-goals>
  <item>Does not persist keys or aliases — returns resolution results only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: RefreshIdentityResolver with resolveOrCreate and isValidId.</item>
</CHANGE_SUMMARY>
*/
import {
  createRecordId,
  isValidRecordId,
  matchDefinitionOnRefresh,
  type KeyEntry,
  type AliasEntry,
  type RefreshMatchResult,
} from "@roguelike-games-ib/knowledge-core";

export class RefreshIdentityResolver {
  constructor(
    private readonly currentKeys: KeyEntry[],
    private readonly aliases: AliasEntry[],
    private readonly sourceId: string,
  ) {}

  resolveOrCreate(kind: string, slug: string, nativeId: string): {
    id: string;
    key: string;
    isNew: boolean;
    isRename: boolean;
    oldKey: string | null;
  } {
    const result = matchDefinitionOnRefresh(
      this.currentKeys,
      this.aliases,
      this.sourceId,
      kind,
      slug,
      nativeId,
    );

    const key = `${this.sourceId}/${kind}/${slug}`;

    if (result.matched && result.id) {
      return {
        id: result.id,
        key,
        isNew: false,
        isRename: result.key_changed,
        oldKey: result.old_key ?? null,
      };
    }

    return {
      id: createRecordId(),
      key,
      isNew: true,
      isRename: false,
      oldKey: null,
    };
  }

  static isValidId(id: string): boolean {
    return isValidRecordId(id);
  }
}
