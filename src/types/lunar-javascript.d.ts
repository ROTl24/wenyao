declare module 'lunar-javascript' {
  export class EightChar {
    getYearDiShi(): string;
    getMonthDiShi(): string;
    getDayDiShi(): string;
    getTimeDiShi(): string;
  }

  export class Lunar {
    getDayInGanZhiExact(): string;
    getDayGanExact(): string;
    getDayZhiExact(): string;
    getMonthInGanZhiExact(): string;
    getMonthZhiExact(): string;
    getYearInGanZhiExact(): string;
    getTimeInGanZhi(): string;
    getEightChar(): EightChar;
  }

  export class Solar {
    static fromDate(date: Date): Solar;
    getLunar(): Lunar;
  }
}
