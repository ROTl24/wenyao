# 《周易》经文数据说明

应用内的卦辞、爻辞来自维基文库《周易》逐卦页面。原典页面标注为公有领域，维基文库转录文本按 Creative Commons Attribution-ShareAlike 4.0 International（CC BY-SA 4.0）提供。

- 作品索引：https://zh.wikisource.org/wiki/周易
- 固定索引版本：https://zh.wikisource.org/w/index.php?title=周易&oldid=7907208
- 转录许可：https://creativecommons.org/licenses/by-sa/4.0/
- 数据文件：`src/data/zhouyi-classics.json`
- 重建脚本：`scripts/build-classics.mjs`

数据文件为每一卦保存对应维基文库页面标题及修订号。重建脚本在数据文件存在时使用这些修订号，不跟随页面后续编辑，从而保持应用输出可复现。
