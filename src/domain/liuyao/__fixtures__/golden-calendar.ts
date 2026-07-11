import type { Branch, GanZhi, PillarKind, XunName } from '../model.js';

type XunGolden = readonly [GanZhi, XunName, readonly [Branch, Branch]];
type FourPillarsGolden = Readonly<Record<PillarKind, GanZhi>>;

interface JieBoundaryGolden {
  readonly name: string;
  readonly beforeInstant: string;
  readonly atInstant: string;
  readonly before: FourPillarsGolden;
  readonly at: FourPillarsGolden;
}

export const SIXTY_JIA_ZI_GOLDEN = [
  ['甲子', '甲子旬', ['戌', '亥']],
  ['乙丑', '甲子旬', ['戌', '亥']],
  ['丙寅', '甲子旬', ['戌', '亥']],
  ['丁卯', '甲子旬', ['戌', '亥']],
  ['戊辰', '甲子旬', ['戌', '亥']],
  ['己巳', '甲子旬', ['戌', '亥']],
  ['庚午', '甲子旬', ['戌', '亥']],
  ['辛未', '甲子旬', ['戌', '亥']],
  ['壬申', '甲子旬', ['戌', '亥']],
  ['癸酉', '甲子旬', ['戌', '亥']],

  ['甲戌', '甲戌旬', ['申', '酉']],
  ['乙亥', '甲戌旬', ['申', '酉']],
  ['丙子', '甲戌旬', ['申', '酉']],
  ['丁丑', '甲戌旬', ['申', '酉']],
  ['戊寅', '甲戌旬', ['申', '酉']],
  ['己卯', '甲戌旬', ['申', '酉']],
  ['庚辰', '甲戌旬', ['申', '酉']],
  ['辛巳', '甲戌旬', ['申', '酉']],
  ['壬午', '甲戌旬', ['申', '酉']],
  ['癸未', '甲戌旬', ['申', '酉']],

  ['甲申', '甲申旬', ['午', '未']],
  ['乙酉', '甲申旬', ['午', '未']],
  ['丙戌', '甲申旬', ['午', '未']],
  ['丁亥', '甲申旬', ['午', '未']],
  ['戊子', '甲申旬', ['午', '未']],
  ['己丑', '甲申旬', ['午', '未']],
  ['庚寅', '甲申旬', ['午', '未']],
  ['辛卯', '甲申旬', ['午', '未']],
  ['壬辰', '甲申旬', ['午', '未']],
  ['癸巳', '甲申旬', ['午', '未']],

  ['甲午', '甲午旬', ['辰', '巳']],
  ['乙未', '甲午旬', ['辰', '巳']],
  ['丙申', '甲午旬', ['辰', '巳']],
  ['丁酉', '甲午旬', ['辰', '巳']],
  ['戊戌', '甲午旬', ['辰', '巳']],
  ['己亥', '甲午旬', ['辰', '巳']],
  ['庚子', '甲午旬', ['辰', '巳']],
  ['辛丑', '甲午旬', ['辰', '巳']],
  ['壬寅', '甲午旬', ['辰', '巳']],
  ['癸卯', '甲午旬', ['辰', '巳']],

  ['甲辰', '甲辰旬', ['寅', '卯']],
  ['乙巳', '甲辰旬', ['寅', '卯']],
  ['丙午', '甲辰旬', ['寅', '卯']],
  ['丁未', '甲辰旬', ['寅', '卯']],
  ['戊申', '甲辰旬', ['寅', '卯']],
  ['己酉', '甲辰旬', ['寅', '卯']],
  ['庚戌', '甲辰旬', ['寅', '卯']],
  ['辛亥', '甲辰旬', ['寅', '卯']],
  ['壬子', '甲辰旬', ['寅', '卯']],
  ['癸丑', '甲辰旬', ['寅', '卯']],

  ['甲寅', '甲寅旬', ['子', '丑']],
  ['乙卯', '甲寅旬', ['子', '丑']],
  ['丙辰', '甲寅旬', ['子', '丑']],
  ['丁巳', '甲寅旬', ['子', '丑']],
  ['戊午', '甲寅旬', ['子', '丑']],
  ['己未', '甲寅旬', ['子', '丑']],
  ['庚申', '甲寅旬', ['子', '丑']],
  ['辛酉', '甲寅旬', ['子', '丑']],
  ['壬戌', '甲寅旬', ['子', '丑']],
  ['癸亥', '甲寅旬', ['子', '丑']],
] as const satisfies readonly XunGolden[];

export const JIE_BOUNDARIES_2026 = [
  {
    name: '小寒',
    beforeInstant: '2026-01-05T08:23:09.000Z',
    atInstant: '2026-01-05T08:23:10.000Z',
    before: { year: '乙巳', month: '戊子', day: '己卯', hour: '壬申' },
    at: { year: '乙巳', month: '己丑', day: '己卯', hour: '壬申' },
  },
  {
    name: '立春',
    beforeInstant: '2026-02-03T20:02:07.000Z',
    atInstant: '2026-02-03T20:02:08.000Z',
    before: { year: '乙巳', month: '己丑', day: '己酉', hour: '丙寅' },
    at: { year: '丙午', month: '庚寅', day: '己酉', hour: '丙寅' },
  },
  {
    name: '惊蛰',
    beforeInstant: '2026-03-05T13:58:59.000Z',
    atInstant: '2026-03-05T13:59:00.000Z',
    before: { year: '丙午', month: '庚寅', day: '戊寅', hour: '癸亥' },
    at: { year: '丙午', month: '辛卯', day: '戊寅', hour: '癸亥' },
  },
  {
    name: '清明',
    beforeInstant: '2026-04-04T18:39:59.000Z',
    atInstant: '2026-04-04T18:40:00.000Z',
    before: { year: '丙午', month: '辛卯', day: '己酉', hour: '乙丑' },
    at: { year: '丙午', month: '壬辰', day: '己酉', hour: '乙丑' },
  },
  {
    name: '立夏',
    beforeInstant: '2026-05-05T11:48:43.000Z',
    atInstant: '2026-05-05T11:48:44.000Z',
    before: { year: '丙午', month: '壬辰', day: '己卯', hour: '甲戌' },
    at: { year: '丙午', month: '癸巳', day: '己卯', hour: '甲戌' },
  },
  {
    name: '芒种',
    beforeInstant: '2026-06-05T15:48:20.000Z',
    atInstant: '2026-06-05T15:48:21.000Z',
    before: { year: '丙午', month: '癸巳', day: '辛亥', hour: '戊子' },
    at: { year: '丙午', month: '甲午', day: '辛亥', hour: '戊子' },
  },
  {
    name: '小暑',
    beforeInstant: '2026-07-07T01:56:56.000Z',
    atInstant: '2026-07-07T01:56:57.000Z',
    before: { year: '丙午', month: '甲午', day: '壬午', hour: '乙巳' },
    at: { year: '丙午', month: '乙未', day: '壬午', hour: '乙巳' },
  },
  {
    name: '立秋',
    beforeInstant: '2026-08-07T11:42:42.000Z',
    atInstant: '2026-08-07T11:42:43.000Z',
    before: { year: '丙午', month: '乙未', day: '癸丑', hour: '壬戌' },
    at: { year: '丙午', month: '丙申', day: '癸丑', hour: '壬戌' },
  },
  {
    name: '白露',
    beforeInstant: '2026-09-07T14:41:15.000Z',
    atInstant: '2026-09-07T14:41:16.000Z',
    before: { year: '丙午', month: '丙申', day: '甲申', hour: '乙亥' },
    at: { year: '丙午', month: '丁酉', day: '甲申', hour: '乙亥' },
  },
  {
    name: '寒露',
    beforeInstant: '2026-10-08T06:29:16.000Z',
    atInstant: '2026-10-08T06:29:17.000Z',
    before: { year: '丙午', month: '丁酉', day: '乙卯', hour: '癸未' },
    at: { year: '丙午', month: '戊戌', day: '乙卯', hour: '癸未' },
  },
  {
    name: '立冬',
    beforeInstant: '2026-11-07T09:52:04.000Z',
    atInstant: '2026-11-07T09:52:05.000Z',
    before: { year: '丙午', month: '戊戌', day: '乙酉', hour: '乙酉' },
    at: { year: '丙午', month: '己亥', day: '乙酉', hour: '乙酉' },
  },
  {
    name: '大雪',
    beforeInstant: '2026-12-07T02:52:31.000Z',
    atInstant: '2026-12-07T02:52:32.000Z',
    before: { year: '丙午', month: '己亥', day: '乙卯', hour: '辛巳' },
    at: { year: '丙午', month: '庚子', day: '乙卯', hour: '辛巳' },
  },
] as const satisfies readonly JieBoundaryGolden[];
