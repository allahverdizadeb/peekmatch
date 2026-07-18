/*
  Warnings:

  - Added the required column `email` to the `Suggestion` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Suggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "email" TEXT NOT NULL
);
INSERT INTO "new_Suggestion" ("category", "createdAt", "id", "text") SELECT "category", "createdAt", "id", "text" FROM "Suggestion";
DROP TABLE "Suggestion";
ALTER TABLE "new_Suggestion" RENAME TO "Suggestion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
