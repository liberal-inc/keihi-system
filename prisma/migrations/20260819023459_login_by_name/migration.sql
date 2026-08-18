-- 名前だけでログインする方式へ変更する
-- 1) loginName を追加（まずは NULL 許容で追加し、既存行を埋める）
ALTER TABLE `User` ADD COLUMN `loginName` VARCHAR(191) NULL;

-- 既存ユーザーは表示名をそのままログイン名として引き継ぐ
UPDATE `User` SET `loginName` = `name` WHERE `loginName` IS NULL;

-- 2) NOT NULL + ユニーク制約を付与する
ALTER TABLE `User` MODIFY `loginName` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `User_loginName_key` ON `User`(`loginName`);

-- 3) メールアドレスは任意項目にする（ログインに使わなくなるため）
ALTER TABLE `User` MODIFY `email` VARCHAR(191) NULL;

-- 4) パスワードは使用しないため削除する
ALTER TABLE `User` DROP COLUMN `passwordHash`;
