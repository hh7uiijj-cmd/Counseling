/*
  Warnings:

  - You are about to drop the column `topic` on the `Booking` table. All the data in the column will be lost.
  - Added the required column `consultationFormat` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `faculty` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lineId` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `major` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `topicCategory` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `yearLevel` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Made the column `clientEmail` on table `Booking` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'LGBTQ');

-- CreateEnum
CREATE TYPE "YearLevel" AS ENUM ('YEAR_1', 'YEAR_2', 'YEAR_3', 'YEAR_4');

-- CreateEnum
CREATE TYPE "Faculty" AS ENUM ('EDUCATION', 'SCIENCE_TECHNOLOGY', 'HUMANITIES_SOCIAL_SCIENCES', 'MANAGEMENT_SCIENCE', 'NURSING', 'CULINARY_ARTS', 'TOURISM_HOSPITALITY', 'LAW_POLITICS', 'SUPHANBURI_CAMPUS', 'NAKHONNAYOK_CENTER', 'LAMPANG_CENTER', 'HUAHIN_CENTER', 'TRANG_CENTER');

-- CreateEnum
CREATE TYPE "ConsultationTopic" AS ENUM ('STUDY', 'LIFE', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsultationFormat" AS ENUM ('ONLINE', 'ONSITE');

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "topic",
ADD COLUMN     "consultationFormat" "ConsultationFormat" NOT NULL,
ADD COLUMN     "faculty" "Faculty" NOT NULL,
ADD COLUMN     "gender" "Gender" NOT NULL,
ADD COLUMN     "lineId" TEXT NOT NULL,
ADD COLUMN     "major" TEXT NOT NULL,
ADD COLUMN     "studentId" TEXT,
ADD COLUMN     "topicCategory" "ConsultationTopic" NOT NULL,
ADD COLUMN     "topicOther" TEXT,
ADD COLUMN     "yearLevel" "YearLevel" NOT NULL,
ALTER COLUMN "clientEmail" SET NOT NULL;
