import type { Contractor, Permit, Violation, Checklist, NormDocument } from "@/app/types";

export const mockContractors: Contractor[] = [
  { id: "1", sequentialNumber: 1, name: "ООО «СтройЭнергоМонтаж»", inn: "7712345678", kpp: "771201001", legalAddress: "г. Москва, ул. Промышленная, д. 15", contactPersonName: "info@stroymont.ru", contactPhone: null, contactEmail: "info@stroymont.ru", status: "active", _count: { employees: 24 } },
  { id: "2", sequentialNumber: 2, name: "АО «ТрансТехСервис»", inn: "7723456789", kpp: "772301001", legalAddress: "г. Калуга, пр. Мира, д. 42", contactPersonName: "office@tts-service.ru", contactPhone: null, contactEmail: "office@tts-service.ru", status: "active", _count: { employees: 18 } },
  { id: "3", sequentialNumber: 3, name: "ООО «ПромВентиляция»", inn: "7734567890", kpp: "773401001", legalAddress: "г. Нижний Новгород, ул. Свободы, д. 8", contactPersonName: "zakaz@promvent.ru", contactPhone: null, contactEmail: "zakaz@promvent.ru", status: "pending", _count: { employees: 12 } },
  { id: "4", sequentialNumber: 4, name: "ИП Козлов А.В.", inn: "404512345678", kpp: "", legalAddress: "г. Обнинск, ул. Ленина, д. 3", contactPersonName: "kozlov.av@mail.ru", contactPhone: null, contactEmail: "kozlov.av@mail.ru", status: "active", _count: { employees: 5 } },
  { id: "5", sequentialNumber: 5, name: "ООО «КлиматКонтроль»", inn: "7745678901", kpp: "774501001", legalAddress: "г. Москва, ул. Академика Королёва, д. 21", contactPersonName: "support@climatcontrol.ru", contactPhone: null, contactEmail: "support@climatcontrol.ru", status: "blocked", _count: { employees: 31 } },
  { id: "6", sequentialNumber: 6, name: "ЗАО «ИнжСистемы»", inn: "7756789012", kpp: "775601001", legalAddress: "г. Санкт-Петербург, Невский пр., д. 100", contactPersonName: "info@engsystems.ru", contactPhone: null, contactEmail: "info@engsystems.ru", status: "active", _count: { employees: 45 } },
  { id: "7", sequentialNumber: 7, name: "ООО «ЭлектроЩит»", inn: "7767890123", kpp: "776701001", legalAddress: "г. Тула, ул. Октябрьская, д. 56", contactPersonName: "sales@electroshield.ru", contactPhone: null, contactEmail: "sales@electroshield.ru", status: "pending", _count: { employees: 16 } },
  { id: "8", sequentialNumber: 8, name: "ООО «АльфаЛогистик»", inn: "7778901234", kpp: "777801001", legalAddress: "г. Москва, Варшавское ш., д. 129", contactPersonName: "info@alfalog.ru", contactPhone: null, contactEmail: "info@alfalog.ru", status: "active", _count: { employees: 22 } },
];

export const mockPermits: Permit[] = [
  { id: "p1", permitNumber: "1-001-07-001", category: "1", contractorName: "ООО «СтройЭнергоМонтаж»", contractorNumber: "001", curatorNumber: "07", sequentialNumber: "001", openDate: "2026-03-10", expiryDate: "2026-04-10", workSite: "Цех №3, участок Б", responsiblePerson: "Петров И.С.", status: "open" },
  { id: "p2", permitNumber: "2-002-05-015", category: "2", contractorName: "АО «ТрансТехСервис»", contractorNumber: "002", curatorNumber: "05", sequentialNumber: "015", openDate: "2026-03-15", expiryDate: "2026-05-15", workSite: "Склад ГСМ, зона 2", responsiblePerson: "Сидорова Е.А.", status: "open" },
  { id: "p3", permitNumber: "1-003-07-042", category: "1", contractorName: "ООО «ПромВентиляция»", contractorNumber: "003", curatorNumber: "07", sequentialNumber: "042", openDate: "2026-02-20", expiryDate: "2026-03-20", workSite: "Вентиляционная камера №12", responsiblePerson: "Козлов Д.М.", status: "closed" },
  { id: "p4", permitNumber: "3-006-03-008", category: "3", contractorName: "ЗАО «ИнжСистемы»", contractorNumber: "006", curatorNumber: "03", sequentialNumber: "008", openDate: "2026-04-01", expiryDate: "2026-06-01", workSite: "Котельная, корпус А", responsiblePerson: "Михайлов С.В.", status: "open" },
  { id: "p5", permitNumber: "2-001-05-003", category: "2", contractorName: "ООО «СтройЭнергоМонтаж»", contractorNumber: "001", curatorNumber: "05", sequentialNumber: "003", openDate: "2026-03-01", expiryDate: "2026-04-01", workSite: "Трансформаторная подстанция", responsiblePerson: "Петров И.С.", status: "early_closed", closeReason: "Работы завершены досрочно" },
  { id: "p6", permitNumber: "1-004-07-019", category: "1", contractorName: "ИП Козлов А.В.", contractorNumber: "004", curatorNumber: "07", sequentialNumber: "019", openDate: "2026-04-05", expiryDate: "2026-05-05", workSite: "Административный корпус, этаж 3", responsiblePerson: "Волкова Н.Г.", status: "open" },
  { id: "p7", permitNumber: "3-008-03-021", category: "3", contractorName: "ООО «АльфаЛогистик»", contractorNumber: "008", curatorNumber: "03", sequentialNumber: "021", openDate: "2026-03-25", expiryDate: "2026-04-25", workSite: "Погрузочная зона №4", responsiblePerson: "Кузнецов Р.А.", status: "open" },
  { id: "p8", permitNumber: "2-007-05-007", category: "2", contractorName: "ООО «ЭлектроЩит»", contractorNumber: "007", curatorNumber: "05", sequentialNumber: "007", openDate: "2026-04-08", expiryDate: "2026-06-08", workSite: "Распределительный щит РЩ-5", responsiblePerson: "Новиков П.Л.", status: "open" },
  { id: "p9", permitNumber: "1-002-07-055", category: "1", contractorName: "АО «ТрансТехСервис»", contractorNumber: "002", curatorNumber: "07", sequentialNumber: "055", openDate: "2026-02-01", expiryDate: "2026-03-01", workSite: "Гаражный комплекс, бокс 7", responsiblePerson: "Сидорова Е.А.", status: "closed" },
  { id: "p10", permitNumber: "3-006-03-012", category: "3", contractorName: "ЗАО «ИнжСистемы»", contractorNumber: "006", curatorNumber: "03", sequentialNumber: "012", openDate: "2026-04-09", expiryDate: "2026-07-09", workSite: "Насосная станция №2", responsiblePerson: "Михайлов С.В.", status: "open" },
];

export const mockViolations: Violation[] = [
  { id: "v1", violationNumber: "VIO-00001", contractorName: "ООО «КлиматКонтроль»", date: "2026-04-02", description: "Работы на высоте без страховочного пояса", severity: "critical", status: "pending" },
  { id: "v2", violationNumber: "VIO-00002", contractorName: "ООО «СтройЭнергоМонтаж»", date: "2026-03-28", description: "Отсутствие ограждения на рабочем месте", severity: "medium", status: "resolved" },
  { id: "v3", violationNumber: "VIO-00003", contractorName: "АО «ТрансТехСервис»", date: "2026-04-05", description: "Нарушение порядка хранения инструментов", severity: "low", status: "pending" },
  { id: "v4", violationNumber: "VIO-00004", contractorName: "ИП Козлов А.В.", date: "2026-03-15", description: "Работа без допуска по электробезопасности", severity: "high", status: "resolved" },
  { id: "v5", violationNumber: "VIO-00005", contractorName: "ООО «ПромВентиляция»", date: "2026-04-07", description: "Неисправный электроинструмент на объекте", severity: "high", status: "pending" },
];

export const mockChecklists: Checklist[] = [
  { id: "c1", contractorName: "ООО «СтройЭнергоМонтаж»", date: "2026-04-01", inspector: "Иванов А.С.", totalItems: 25, passedItems: 23, score: 92, status: "passed" },
  { id: "c2", contractorName: "АО «ТрансТехСервис»", date: "2026-03-25", inspector: "Смирнова О.В.", totalItems: 25, passedItems: 18, score: 72, status: "failed" },
  { id: "c3", contractorName: "ЗАО «ИнжСистемы»", date: "2026-04-08", inspector: "Иванов А.С.", totalItems: 25, passedItems: 21, score: 84, status: "passed" },
  { id: "c4", contractorName: "ООО «АльфаЛогистик»", date: "2026-04-09", inspector: "Петров Д.И.", totalItems: 25, passedItems: 15, score: 60, status: "in_progress" },
];

export const mockNormDocuments: NormDocument[] = [
  { id: "nd1", title: "Правила охраны труда при работе на высоте", category: "Охрана труда", type: "pdf", updatedAt: "2026-03-15" },
  { id: "nd2", title: "Инструкция по электробезопасности (до 1000В)", category: "Электробезопасность", type: "docx", updatedAt: "2026-02-20" },
  { id: "nd3", title: "Положение о допуске подрядных организаций", category: "Организационные", type: "pdf", updatedAt: "2026-04-01" },
  { id: "nd4", title: "Перечень работ повышенной опасности", category: "Охрана труда", type: "xlsx", updatedAt: "2026-03-10" },
  { id: "nd5", title: "Правила пожарной безопасности на территории завода", category: "Пожарная безопасность", type: "pdf", updatedAt: "2026-01-25" },
  { id: "nd6", title: "Требования к СИЗ для подрядных организаций", category: "Охрана труда", type: "docx", updatedAt: "2026-03-30" },
  { id: "nd7", title: "Порядок оформления наряд-допусков", category: "Организационные", type: "pdf", updatedAt: "2026-04-05" },
];
