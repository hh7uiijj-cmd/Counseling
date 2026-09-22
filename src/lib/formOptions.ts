export const GENDER_OPTIONS = [
  { value: "MALE", label: "ชาย" },
  { value: "FEMALE", label: "หญิง" },
  { value: "LGBTQ", label: "LGBTQ+" },
] as const;

export const YEAR_LEVEL_OPTIONS = [
  { value: "YEAR_1", label: "ปีที่ 1" },
  { value: "YEAR_2", label: "ปีที่ 2" },
  { value: "YEAR_3", label: "ปีที่ 3" },
  { value: "YEAR_4", label: "ปีที่ 4" },
] as const;

export const FACULTY_OPTIONS = [
  { value: "EDUCATION", label: "คณะครุศาสตร์" },
  { value: "SCIENCE_TECHNOLOGY", label: "คณะวิทยาศาสตร์และเทคโนโลยี" },
  { value: "HUMANITIES_SOCIAL_SCIENCES", label: "คณะมนุษยศาสตร์และสังคมศาสตร์" },
  { value: "MANAGEMENT_SCIENCE", label: "คณะวิทยาการจัดการ" },
  { value: "NURSING", label: "คณะพยาบาลศาสตร์" },
  { value: "CULINARY_ARTS", label: "โรงเรียนการเรือน" },
  { value: "TOURISM_HOSPITALITY", label: "โรงเรียนการท่องเที่ยวและการบริการ" },
  { value: "LAW_POLITICS", label: "โรงเรียนกฎหมายและการเมือง" },
  { value: "SUPHANBURI_CAMPUS", label: "วิทยาเขตสุพรรณบุรี" },
  { value: "NAKHONNAYOK_CENTER", label: "ศูนย์การศึกษานครนายก" },
  { value: "LAMPANG_CENTER", label: "ศูนย์การศึกษาลำปาง" },
  { value: "HUAHIN_CENTER", label: "ศูนย์การศึกษาหัวหิน" },
  { value: "TRANG_CENTER", label: "ศูนย์การศึกษาตรัง" },
] as const;

export const TOPIC_OPTIONS = [
  { value: "STUDY", label: "การเรียน" },
  { value: "LIFE", label: "การใช้ชีวิต" },
  { value: "OTHER", label: "อื่นๆ" },
] as const;

export const FORMAT_OPTIONS = [
  { value: "ONLINE", label: "Online: MS Teams" },
  { value: "ONSITE", label: "Onsite: ห้อง SDU Counseling Center อาคาร 2 ชั้น 2" },
] as const;

function toLabelMap(options: readonly { value: string; label: string }[]) {
  return Object.fromEntries(options.map((o) => [o.value, o.label])) as Record<string, string>;
}

export const GENDER_LABELS = toLabelMap(GENDER_OPTIONS);
export const YEAR_LEVEL_LABELS = toLabelMap(YEAR_LEVEL_OPTIONS);
export const FACULTY_LABELS = toLabelMap(FACULTY_OPTIONS);
export const TOPIC_LABELS = toLabelMap(TOPIC_OPTIONS);
export const FORMAT_LABELS = toLabelMap(FORMAT_OPTIONS);
