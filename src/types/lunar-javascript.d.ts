declare module 'lunar-javascript' {
  export class EightChar {
    getYearDiShi(): string;
    getMonthDiShi(): string;
    getDayDiShi(): string;
    getTimeDiShi(): string;
  }

  export class Lunar {
    getDayInGanZhiExact(): string;
    getDayInChinese(): string;
    getDayGanExact(): string;
    getDayZhiExact(): string;
    getMonthInGanZhiExact(): string;
    getMonthInChinese(): string;
    getMonthZhiExact(): string;
    getYearInGanZhi(): string;
    getYearInGanZhiExact(): string;
    getTimeInGanZhi(): string;
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
