declare module 'lunar-javascript' {
  export class EightChar {
    getYearDiShi(): string;
    getMonthDiShi(): string;
    getDayDiShi(): string;
    getTimeDiShi(): string;
  }

  export class Lunar {
    getAnimal(): string;
    getDayChongDesc(): string;
    getDayPositionCaiDesc(): string;
    getDayPositionFuDesc(sect?: number): string;
    getDayPositionXiDesc(): string;
    getDayPositionYangGuiDesc(): string;
    getDayPositionYinGuiDesc(): string;
    getDaySha(): string;
    getDayTianShen(): string;
    getDayTianShenLuck(): string;
    getDayTianShenType(): string;
    getDayInGanZhiExact(): string;
    getDayInChinese(): string;
    getDay(): number;
    getDayGanExact(): string;
    getDayZhiExact(): string;
    getJieQi(): string;
    getMonthInGanZhiExact(): string;
    getMonthInChinese(): string;
    getMonth(): number;
    getMonthZhiExact(): string;
    getYearInGanZhi(): string;
    getYearZhi(): string;
    getYearInGanZhiExact(): string;
    getTimeInGanZhi(): string;
    getXiu(): string;
    getXiuLuck(): string;
    getZheng(): string;
    getZhiXing(): string;
    getEightChar(): EightChar;
  }

  export class Solar {
    static fromDate(date: Date): Solar;
    static fromYmd(year: number, month: number, day: number): Solar;
    static fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): Solar;
    getLunar(): Lunar;
  }
}
