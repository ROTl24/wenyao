declare module 'lunar-javascript' {
  export class Lunar {
    getDayInGanZhiExact(): string;
    getDayGanExact(): string;
    getDayZhiExact(): string;
    getMonthInGanZhiExact(): string;
    getMonthZhiExact(): string;
    getYearInGanZhiExact(): string;
    getTimeInGanZhi(): string;
  }

  export class Solar {
    static fromDate(date: Date): Solar;
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
