/// <reference path="../.astro/types.d.ts" />

/*
<MODULE_CONTRACT>
<purpose>Declares ambient type definitions for the Astro web application, including the App.Locals interface for distDir.</purpose>
<non-goals>
  <item>Does not implement runtime logic — type declarations only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: App.Locals interface with distDir property.</item>
</CHANGE_SUMMARY>
*/

declare namespace App {
  interface Locals {
    distDir: string;
  }
}
