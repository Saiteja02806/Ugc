import release from "./explore-wall-money-reference-release.json" with { type: "json" };
import { formatTextLayout, parseExploreFormatEdit, type ExploreFormatText } from "./explore-format-edit.ts";

export const WALL_INITIAL_TEXT_LAYOUT_VERSION = 1;
export type WallTextRegion = { paragraphs: number; width: number; y: number; fontSize: number; sourceLines: number; color?: string; align?: "left"; boxed?: boolean };
export type WallTextProfile = { version: 1; referenceId: string; sourceSha256: string; width: number; y: number; fontSize: number; lineHeight: number; outlineWidth: number; sourceLines: number; color?: string; font?: "robotocondensed"; structure?: "heading-body-v1"; align?: "left"; regions?: WallTextRegion[] };
// Original-resolution opening-frame review. Font is the app's existing face,
// not a claim that the unknown source font has been identified.
const measurements = [
  { width: .84, y: .62, fontSize: 54, lineHeight: 1.20, outlineWidth: 8, sourceLines: 6 },
  { width: .62, y: .40, fontSize: 50, lineHeight: 1.24, outlineWidth: 8, sourceLines: 6 },
  { width: .65, y: .53, fontSize: 58, lineHeight: 1.12, outlineWidth: 8, sourceLines: 4 },
  { width: .64, y: .46, fontSize: 46, lineHeight: 1.17, outlineWidth: 1, sourceLines: 8 },
  { width: .64, y: .57, fontSize: 64, lineHeight: 1.16, outlineWidth: 8, sourceLines: 4 },
  { width: .64, y: .525, fontSize: 44, lineHeight: 1.24, outlineWidth: 8, sourceLines: 10 },
] as const;
// Reviewed original openings; bind stable IDs directly to immutable source hashes.
const additionalProfiles: WallTextProfile[] = [
  { version: 1, referenceId: "explore-wall-text-27", sourceSha256: "05e2ca9de89fb9a58448c9763666960d35841a4359454b8b1da22b2c2949c065", width: .70, y: .36, fontSize: 36, lineHeight: 1.2, outlineWidth: 4, sourceLines: 14, regions: [{ paragraphs: 1, width: .55, y: .10, fontSize: 34, sourceLines: 2 }, { paragraphs: 1, width: .70, y: .36, fontSize: 36, sourceLines: 10 }] },
  { version: 1, referenceId: "explore-wall-text-8ed8ad307341d9c3", sourceSha256: "8ed8ad307341d9c33504f23e772d795687a49614a934f685c1eb022a5d1d166b", width: .65, y: .36, fontSize: 54, lineHeight: 1.2, outlineWidth: 4, sourceLines: 13, regions: [{ paragraphs: 1, width: .65, y: .277, fontSize: 54, sourceLines: 1, color: "#000000", boxed: true }, { paragraphs: 1, width: .65, y: .36, fontSize: 54, sourceLines: 8 }, { paragraphs: 1, width: .55, y: .695, fontSize: 56, sourceLines: 2, color: "#000000", boxed: true }] },
  { version: 1, referenceId: "explore-wall-text-242588ba1be47a25", sourceSha256: "242588ba1be47a251de58e2ef11641557c8a450d92fefd4f013a76c650c95184", width: .48, y: .225, fontSize: 34, lineHeight: 1.2, outlineWidth: 3, sourceLines: 25, regions: [{ paragraphs: 1, width: .60, y: .115, fontSize: 64, sourceLines: 1, boxed: true }, { paragraphs: 6, width: .48, y: .225, fontSize: 34, sourceLines: 23, align: "left" }] },
  { version: 1, referenceId: "explore-wall-text-15c1344dbc9683f6", sourceSha256: "15c1344dbc9683f6e4de403ee0584935cab6dddebd978b77ee9aac671f6dddff", width: .55, y: .43, fontSize: 36, lineHeight: 1.2, outlineWidth: 4, sourceLines: 7, regions: [{ paragraphs: 1, width: .55, y: .43, fontSize: 36, sourceLines: 2 }, { paragraphs: 1, width: .55, y: .49, fontSize: 36, sourceLines: 2 }, { paragraphs: 1, width: .55, y: .56, fontSize: 36, sourceLines: 1 }] },
{"version":1,"referenceId":"explore-wall-text-37","sourceSha256":"6bb5beae94b69524750571f3e8fdacba82e872ee3d25a9fb8d3abf6a33526202","width":0.7,"y":0.53,"fontSize":70,"lineHeight":1.2,"outlineWidth":3,"sourceLines":7,"color":"#fff2a3"},
  {"version":1,"referenceId":"explore-wall-text-53","sourceSha256":"f0e2928e29d1cc603e0e65e6ed2eb8bdd2ed93ec390ad1c3529fc4a9ffb83d4d","width":0.64,"y":0.36,"fontSize":37,"lineHeight":1.2,"outlineWidth":3,"sourceLines":19,"color":"#fff2a3"},
  {"version":1,"referenceId":"explore-wall-text-952c9e951086145c","sourceSha256":"952c9e951086145cbedc9bf87c6e16b97eb0d259d98f5b1554bc82160bcc3ce0","width":0.54,"y":0.25,"fontSize":36,"lineHeight":1.2,"outlineWidth":4,"sourceLines":17,"align":"left"},
  {"version":1,"referenceId":"explore-paired-wall_text-d2a11374187469b8f8baee61","sourceSha256":"f141a3fd805a4de02ab071c359c6c2dca9febb478bf0d7db3ff33713ff55c2df","width":0.46,"y":0.26,"fontSize":30,"lineHeight":1.1,"outlineWidth":2,"sourceLines":28,"align":"left","color":"#fff2a3"},
  {"version":1,"referenceId":"explore-wall-text-e1d5e39019c57edd","sourceSha256":"e1d5e39019c57edd0a5d0be29caac56100bd47c3bd2789108eb35354c08bdc6d","width":0.78,"y":0.12,"fontSize":50,"lineHeight":1.4,"outlineWidth":8,"sourceLines":18},
  {"version":1,"referenceId":"explore-wall-text-edcf31d415ad6095","sourceSha256":"edcf31d415ad609571ad97d53c15575ae28389dc5a2a760a3da71b60b403a70f","width":0.43,"y":0.53,"fontSize":40,"lineHeight":1.2,"outlineWidth":3,"sourceLines":7},
  {"version":1,"referenceId":"explore-wall-text-186edbf9361266e6","sourceSha256":"186edbf9361266e66708ce9ec114a09e7e0b37ffd03dafbcafb8d0cdbaf0dbd2","width":0.65,"y":0.42,"fontSize":65,"lineHeight":1.2,"outlineWidth":8,"sourceLines":6},
  {"version":1,"referenceId":"explore-wall-text-5cdc0bf33fa496f7","sourceSha256":"5cdc0bf33fa496f7613cd2f12108b5f9009097fa9def80d264238dfac04e5ce2","width":0.65,"y":0.17,"fontSize":32,"lineHeight":1.25,"outlineWidth":6,"sourceLines":33},
  {"version":1,"referenceId":"explore-wall-text-6ef884242109d8db","sourceSha256":"6ef884242109d8db10269071ef7d09341f67df9dfeb02074737ab15b33d5ea75","width":0.48,"y":0.54,"fontSize":43,"lineHeight":1.2,"outlineWidth":3,"sourceLines":8},
  {"version":1,"referenceId":"explore-wall-text-cf2340e8e4407dab","sourceSha256":"cf2340e8e4407daba38a25e050155609929cdd6c3dfedcc6cd6d8018300f2499","width":0.76,"y":0.46,"fontSize":48,"lineHeight":1.2,"outlineWidth":3,"sourceLines":5},
  {"version":1,"referenceId":"explore-wall-text-1a22e628bb1a4428","sourceSha256":"1a22e628bb1a4428aca80315baf8957901784f5bcd7d5ae9385d3e37e6612c09","width":0.78,"y":0.46,"fontSize":40,"lineHeight":1.2,"outlineWidth":3,"sourceLines":4},
  {"version":1,"referenceId":"explore-wall-text-d496fde4808ff903","sourceSha256":"d496fde4808ff903e78a89d3557c9a3e624a938999c928d1e4edfb46e20a2a88","width":0.48,"y":0.385,"fontSize":40,"lineHeight":1.18,"outlineWidth":6,"sourceLines":13},
  {"version":1,"referenceId":"explore-wall-text-765ce326c924aaf6","sourceSha256":"765ce326c924aaf62ef1eff280149d155af46b6779f25fcdfbbb39e66f8d981e","width":0.58,"y":0.27,"fontSize":43,"lineHeight":1.2,"outlineWidth":7,"sourceLines":19},
  {"version":1,"referenceId":"explore-wall-text-dd3e344317913399","sourceSha256":"dd3e344317913399689037afe8bd57bcc89fcb2c8d6a253e01ce9216d8ecbec2","width":0.63,"y":0.39,"fontSize":50,"lineHeight":1.3,"outlineWidth":7,"sourceLines":11,"font":"robotocondensed"},
  {"version":1,"referenceId":"explore-wall-text-f02839f347ec57fe","sourceSha256":"f02839f347ec57fe5a22a5cf476de70af95ddbb280ca00777e1d8e28e7dfc8bf","width":0.72,"y":0.23,"fontSize":51,"lineHeight":1.3,"outlineWidth":7,"sourceLines":15,"font":"robotocondensed"},
  {"version":1,"referenceId":"explore-wall-text-0fad669fefb4c9e6","sourceSha256":"0fad669fefb4c9e62044ce43dcc47e56d2a10622c4c6c6daef5b43002f39186c","width":0.74,"y":0.57,"fontSize":48,"lineHeight":1.3,"outlineWidth":1,"sourceLines":8},
  {"version":1,"referenceId":"explore-paired-wall_text-d3259c1239762b2daa319893","sourceSha256":"0acefbc240ce818d77f3f931ca0e926c30adf5e312351af3eee37308fc1a7e1f","width":0.78,"y":0.22,"fontSize":74,"lineHeight":1.2,"outlineWidth":1,"sourceLines":12,"color":"#f2c8ec"},
  {"version":1,"referenceId":"explore-paired-wall_text-499cd7912d85e60e54ac54be","sourceSha256":"5d981058d36a18ea56b4d80a84276fc2651ab40b25bf6f4a50e0f1ad258f9a64","width":0.83,"y":0.2,"fontSize":56,"lineHeight":1.2,"outlineWidth":3,"sourceLines":17},
  {"version":1,"referenceId":"explore-paired-wall_text-abb1480dfd075d5c7923b4d6","sourceSha256":"8c613115aa74dd01e6752bf85dc4f0decefdad36cd42cfb335de2124f60efce2","width":0.48,"y":0.24,"fontSize":36,"lineHeight":1.2,"outlineWidth":1,"sourceLines":23,"color":"#fff2a3"},
  {"version":1,"referenceId":"explore-paired-wall_text-f056193f755c5158c5e8a7c4","sourceSha256":"964c1592aebc1d5d351600d06cb6851fd066a339dbef2003fdc56fa2ccba4647","width":0.66,"y":0.41,"fontSize":41,"lineHeight":1.2,"outlineWidth":1,"sourceLines":18},
  {"version":1,"referenceId":"explore-wall-text-13","sourceSha256":"a08fd225f13eb78386ecf2dc9ec68a38afef7a1f2bcb60aa4e3ec55673ce8d5a","width":0.76,"y":0.49,"fontSize":64,"lineHeight":1.2,"outlineWidth":4,"sourceLines":9,"color":"#fff2a3"},
  {"version":1,"referenceId":"explore-wall-text-42","sourceSha256":"15790bdf352eed54f155a09ff0b581887f03e2f143399df8d3601ad4291ea5b2","width":0.83,"y":0.57,"fontSize":78,"lineHeight":1.2,"outlineWidth":1,"sourceLines":3},
  {"version":1,"referenceId":"explore-wall-text-50","sourceSha256":"b5312fad4a2a80af1f15c3c01f0319104ee9359551cff88b0923f384f9126b23","width":0.59,"y":0.33,"fontSize":29,"lineHeight":1.2,"outlineWidth":1,"sourceLines":2},
  {"version":1,"referenceId":"explore-wall-text-51","sourceSha256":"cce65d2127e6e81cafb040606c54843dbcbe7dc5e3e8f71b0ac8bc16417e77bf","width":0.69,"y":0.4,"fontSize":39,"lineHeight":1.2,"outlineWidth":6,"sourceLines":12},
  {"version":1,"referenceId":"explore-wall-text-55","sourceSha256":"aa84a0cb05fdb94edd9224d04db2df12e57971b5ff5f795505f6e81e946f7b90","width":0.78,"y":0.31,"fontSize":84,"lineHeight":1.35,"outlineWidth":3,"sourceLines":9},
  {"version":1,"referenceId":"explore-wall-text-10","sourceSha256":"0447b3325486a958ad22964a011000055a9eda4037db6c21983049f5ad96ef8e","width":0.53,"y":0.17,"fontSize":42,"lineHeight":1.2,"outlineWidth":6,"sourceLines":25},
  {"version":1,"referenceId":"explore-wall-text-11","sourceSha256":"3d0e169e6fb98c3822a64a2e87b40c11e71468a6f20cfd92747c232d8d2df64c","width":0.55,"y":0.39,"fontSize":42,"lineHeight":1.2,"outlineWidth":6,"sourceLines":18},
  {"version":1,"referenceId":"explore-wall-text-44","sourceSha256":"0e5ee1c581496d7694eea3293a5f2a66221be031598f9f9bbe01b6928cae54b9","width":0.78,"y":0.5,"fontSize":56,"lineHeight":1.2,"outlineWidth":6,"sourceLines":9},
  {"version":1,"referenceId":"explore-wall-text-47","sourceSha256":"31d752fbfb5e1755d82988297e70de0a5e1fe3ffb759757f50824ec53f1bc022","width":0.64,"y":0.18,"fontSize":39,"lineHeight":1.2,"outlineWidth":6,"sourceLines":26},
  {"version":1,"referenceId":"explore-wall-text-48","sourceSha256":"f1ad8e87dee0746d242e4566347a9e594d6a539a178eab164a9c2ef3795f88e2","width":0.67,"y":0.43,"fontSize":39,"lineHeight":1.2,"outlineWidth":6,"sourceLines":13},
  {"version":1,"referenceId":"explore-wall-text-54","sourceSha256":"a6022fb569c9b9fd0a0ab92aa0c73de314dc0082ec6c681b30451e19ec17adbc","width":0.71,"y":0.4,"fontSize":61,"lineHeight":1.2,"outlineWidth":6,"sourceLines":9},
  {"version":1,"referenceId":"explore-wall-text-60","sourceSha256":"21ef2c4f0d32a95de01fb258194a74c2b7e80ad379542f1af668f88fd37515fb","width":0.53,"y":0.53,"fontSize":39,"lineHeight":1.2,"outlineWidth":6,"sourceLines":7},
  {"version":1,"referenceId":"explore-wall-text-61","sourceSha256":"e719bbb2095bd6899f3a71e8d59775f4c8c92ec58db979f95b8797e9188160eb","width":0.63,"y":0.41,"fontSize":37,"lineHeight":1.2,"outlineWidth":6,"sourceLines":18},
  {"version":1,"referenceId":"explore-wall-text-0d0039479ef4cca9","sourceSha256":"0d0039479ef4cca9fbb24d76ca05f9144c8447dba4dd06de37871fb9696044db","width":0.7,"y":0.46,"fontSize":52,"lineHeight":1.2,"outlineWidth":1,"sourceLines":8},
  {"version":1,"referenceId":"explore-wall-text-ec359c870c62a893","sourceSha256":"ec359c870c62a893a6a5979970fe65f4a814a5f8487c7a7a9d1da270aa1e8269","width":0.65,"y":0.29,"fontSize":51,"lineHeight":1.2,"outlineWidth":7,"sourceLines":13},
  {"version":1,"referenceId":"explore-wall-text-359cef4971f58d83","sourceSha256":"359cef4971f58d8302a6627a8e013e682b71bb469820d673eddc186d7a436a8a","width":0.63,"y":0.37,"fontSize":42,"lineHeight":1.2,"outlineWidth":7,"sourceLines":9},
  {"version":1,"referenceId":"explore-wall-text-d5ac739cb19678ff","sourceSha256":"d5ac739cb19678ffc48ffaea37c12689f8d52e042d0b74eb7f767b2264f75522","width":0.65,"y":0.36,"fontSize":55,"lineHeight":1.2,"outlineWidth":7,"sourceLines":11},
  {"version":1,"referenceId":"explore-wall-text-a1616299d8dcc625","sourceSha256":"a1616299d8dcc625d0581c001438048397fe2b6d91ba452524824462b4f5ec55","width":0.8,"y":0.48,"fontSize":53,"lineHeight":1.2,"outlineWidth":7,"sourceLines":9},
  {"version":1,"referenceId":"explore-wall-text-8d69fa9e5c2f3c3b","sourceSha256":"8d69fa9e5c2f3c3b2cd814e8bcacfee65fd3f58f84f702a14e582b157aa15ee4","width":0.75,"y":0.5,"fontSize":51,"lineHeight":1.2,"outlineWidth":7,"sourceLines":9},
  {"version":1,"referenceId":"explore-paired-wall_text-1d9ddc3d4a768263d88460f0","sourceSha256":"c8596e3fd738ccb8ecf4e7a753963d77ced3fc88f4b6b5fcdfaef38025fb8fcb","width":0.65,"y":0.57,"fontSize":55,"lineHeight":1.2,"outlineWidth":1,"sourceLines":4},
  {"version":1,"referenceId":"explore-paired-wall_text-a7691418a6df49c274c4d888","sourceSha256":"0ecc89c0a6b77bf467c0b4c315ab91f5fac2dcf37f846d0f99bc1aecb83bfa05","width":0.61,"y":0.5,"fontSize":46,"lineHeight":1.2,"outlineWidth":1,"sourceLines":5,"color":"#fff2a3"},
  { version: 1, referenceId: "explore-wall-text-f5bc390383e437fb", sourceSha256: "f5bc390383e437fb6f4254191028d29f29bad49436fde633c8d2c1b117eb7d8c", width: .55, y: .56, fontSize: 43, lineHeight: 1.2, outlineWidth: 1, sourceLines: 7 },
  { version: 1, referenceId: "explore-wall-text-c2fbebde7c4f9676", sourceSha256: "c2fbebde7c4f96767537158217005169bb17700965e94239a600312dcfc9a855", width: .55, y: .44, fontSize: 45, lineHeight: 1.2, outlineWidth: 1, sourceLines: 9 },
  { version: 1, referenceId: "explore-wall-text-5286682bcc6952ad", sourceSha256: "5286682bcc6952ad69eef23aff838a0a9f35ff5c1ed3f324fa22e33fc066b7af", width: .69, y: .53, fontSize: 51, lineHeight: 1.2, outlineWidth: 8, sourceLines: 5 },
  { version: 1, referenceId: "explore-wall-text-652f166f3a7a7a8d", sourceSha256: "652f166f3a7a7a8d972183a572e55a004af7ad2a474abc7691f3e2e912594d0c", width: .46, y: .50, fontSize: 36, lineHeight: 1.2, outlineWidth: 1, sourceLines: 9 },
  { version: 1, referenceId: "explore-wall-text-e95ccc86a8f9ee96", sourceSha256: "e95ccc86a8f9ee96e3aecae361f2b8542a1b3635d02bfd9af35f1a8b246f88e4", width: .69, y: .44, fontSize: 56, lineHeight: 1.2, outlineWidth: 8, sourceLines: 9 },
  { version: 1, referenceId: "explore-wall-text-2fe054f77b9d9549", sourceSha256: "2fe054f77b9d9549078f827a6349db161b5a69aa00b7ccf09bc164837a96841b", width: .56, y: .20, fontSize: 44, lineHeight: 1.2, outlineWidth: 6, sourceLines: 7 },
  { version: 1, referenceId: "explore-wall-text-45", sourceSha256: "7ea57256bafa7a2e1cbcbf938b5c1f64163ccaacd14fc7ff0b0c582d961e9821", width: .65, y: .46, fontSize: 57, lineHeight: 1.2, outlineWidth: 6, sourceLines: 9 },
  { version: 1, referenceId: "explore-wall-text-57", sourceSha256: "669e028ec85281c878c4097f5ed288691a2fd4ac4108e476a8d944cfd4671462", width: .75, y: .49, fontSize: 62, lineHeight: 1.2, outlineWidth: 1, sourceLines: 7, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-49", sourceSha256: "6176ef30b5ba7b6b8441cf7f386906fa8ae2c837ac90b75917c781fb15dc59ea", width: .65, y: .47, fontSize: 44, lineHeight: 1.2, outlineWidth: 6, sourceLines: 11 },
  { version: 1, referenceId: "explore-wall-text-52", sourceSha256: "ee9c90f43009da41db25234fc71e8c696152168fc3fdab2d05a441e271533d10", width: .67, y: .525, fontSize: 52, lineHeight: 1.2, outlineWidth: 1, sourceLines: 7 },
  { version: 1, referenceId: "explore-wall-text-56", sourceSha256: "13a67ea02f0bc25efcc0b0373ed47ddf6ad992aee5c4bae997617c6a7451d4ee", width: .77, y: .54, fontSize: 59, lineHeight: 1.2, outlineWidth: 1, sourceLines: 6, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-58", sourceSha256: "5e00fcdcdccb663ba0f4dede663664e84949c742edcef8253089b6ae9965eb51", width: .61, y: .55, fontSize: 56, lineHeight: 1.2, outlineWidth: 8, sourceLines: 4 },
  { version: 1, referenceId: "explore-wall-text-62", sourceSha256: "23d793d45cbaf74db7852b80f3ec5c975ff8e3fa161fd853aed1bdf5d8d1aaec", width: .57, y: .65, fontSize: 51, lineHeight: 1.2, outlineWidth: 1, sourceLines: 5, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-63", sourceSha256: "7c9de089448e1f5ae0c5dfaee0efba2cdf2f009e2e8240b4f54a8cc19908e39a", width: .49, y: .59, fontSize: 39, lineHeight: 1.2, outlineWidth: 4, sourceLines: 7, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-02", sourceSha256: "ef2574943fbc3fea26ccb3f5fa51eef88c1077e25742de059f04f1483e0be46e", width: .72, y: .50, fontSize: 60, lineHeight: 1.20, outlineWidth: 1, sourceLines: 7, color: "#f2c8ec" },
  { version: 1, referenceId: "explore-wall-text-05", sourceSha256: "4d4431a5988c97ac698564ffa479f498cffe020dd8207b81a9687246a98754db", width: .70, y: .515, fontSize: 47, lineHeight: 1.22, outlineWidth: 1, sourceLines: 9 },
  { version: 1, referenceId: "explore-wall-text-03", sourceSha256: "e938455aee8c7f6d06498beaf0c83e9261fb3a5dffb50ba01b067f1443a31519", width: .86, y: .22, fontSize: 60, lineHeight: 1.30, outlineWidth: 1, sourceLines: 15, font: "robotocondensed" },
  { version: 1, referenceId: "explore-wall-text-04", sourceSha256: "5c6419b37b1021c03fe6ea119945c6f80c7d752260b63ffb256e231f7cd2f9f9", width: .63, y: .20, fontSize: 42, lineHeight: 1.22, outlineWidth: 5, sourceLines: 23, structure: "heading-body-v1" },
  { version: 1, referenceId: "explore-wall-text-07", sourceSha256: "bd3dfa9fbb258a1785492bb6889bff0683e512bc10922df1e8ad9b38231f7f1d", width: .76, y: .26, fontSize: 54, lineHeight: 1.17, outlineWidth: 7, sourceLines: 16 },
  { version: 1, referenceId: "explore-wall-text-14", sourceSha256: "2f51464effa68d5cc610c0be76502448f0455fc9ea2bb1a093a1932c7af58c41", width: .72, y: .465, fontSize: 48, lineHeight: 1.22, outlineWidth: 1, sourceLines: 12 },
  { version: 1, referenceId: "explore-wall-text-16", sourceSha256: "9e0001abb70e0281915d8643fec0a23d51ab3555d65f1b334ad6b859735d9d1a", width: .74, y: .425, fontSize: 51, lineHeight: 1.40, outlineWidth: 7, sourceLines: 9 },
  { version: 1, referenceId: "explore-wall-text-12", sourceSha256: "68c35ecf9100cb13e06c7905195ee5795e5c7ee042a71ba3692e9e8cda666afb", width: .49, y: .52, fontSize: 40, lineHeight: 1.19, outlineWidth: 1, sourceLines: 6 },
  { version: 1, referenceId: "explore-wall-text-15", sourceSha256: "7fbab5029bca732aa09571819edf4307ae140f04cbb79fbfab94fa83b057c607", width: .83, y: .455, fontSize: 46, lineHeight: 1.17, outlineWidth: 1, sourceLines: 11 },
  { version: 1, referenceId: "explore-wall-text-17", sourceSha256: "5452d9913012a625c4803d5b7bee51d95b2ade62e877fee1a005be8a1e407067", width: .70, y: .48, fontSize: 44, lineHeight: 1.20, outlineWidth: 4, sourceLines: 14 },
  { version: 1, referenceId: "explore-wall-text-18", sourceSha256: "ea58578e198166693fe77ae16c96cd338409ee473cbacc3c3a2a12c669674b1f", width: .79, y: .435, fontSize: 40, lineHeight: 1.20, outlineWidth: 1, sourceLines: 12 },
  { version: 1, referenceId: "explore-wall-text-19", sourceSha256: "aacb5a9daa979e761c254c4531f77f9d9f4ab5c5512bab179e34f5d26792c327", width: .70, y: .34, fontSize: 44, lineHeight: 1.15, outlineWidth: 7, sourceLines: 15 },
  { version: 1, referenceId: "explore-wall-text-20", sourceSha256: "3f81a33e9a6dc0eebb5652ab99c4101dcb752ddc991b40c46233185fe0ad0590", width: .94, y: .12, fontSize: 47, lineHeight: 1.15, outlineWidth: 7, sourceLines: 27 },
  { version: 1, referenceId: "explore-wall-text-22", sourceSha256: "490ccea2857b301e93cc49cea604d2130feb1839ccbe694b23b052d068bd5972", width: .86, y: .19, fontSize: 76, lineHeight: 1.20, outlineWidth: 8, sourceLines: 4 },
  { version: 1, referenceId: "explore-wall-text-23", sourceSha256: "ab14debaccb190b09af3d935b400fe5e33dfa47b283dee6e6bdeeaf01ee3962d", width: .75, y: .38, fontSize: 46, lineHeight: 1.17, outlineWidth: 7, sourceLines: 15 },
  { version: 1, referenceId: "explore-wall-text-24", sourceSha256: "a29e5c7aca945a72080b69fd6387f766f4437f61de112213474f76784a8db262", width: .82, y: .49, fontSize: 68, lineHeight: 1.20, outlineWidth: 1, sourceLines: 7, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-25", sourceSha256: "f1f03ff0908bd375833c7eff08ddd324fce739d6b2dcba9b4b70959617be71c7", width: .82, y: .22, fontSize: 44, lineHeight: 1.20, outlineWidth: 7, sourceLines: 15 },
  { version: 1, referenceId: "explore-wall-text-26", sourceSha256: "33ea36939e8a37a1a922396262f12e6a1b0137217ffc88231483a2eec28c261e", width: .66, y: .435, fontSize: 38, lineHeight: 1.18, outlineWidth: 1, sourceLines: 7 },
  { version: 1, referenceId: "explore-wall-text-29", sourceSha256: "2e7bf840a4dd6a0cd533ed6734e02712842a28ab51aeb5ef73ef8b951c7f2ae9", width: .84, y: .40, fontSize: 72, lineHeight: 1.20, outlineWidth: 1, sourceLines: 8, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-30", sourceSha256: "b13ee7992436621934fa2de52ed1b35f6fe1a8ae73dd2c2769a4e25a13d78842", width: .90, y: .34, fontSize: 76, lineHeight: 1.20, outlineWidth: 8, sourceLines: 7 },
  { version: 1, referenceId: "explore-wall-text-31", sourceSha256: "53237b1867501d0cad64a1bc4374fd7b71dd70457c9001305bb4115f5000b5c7", width: .84, y: .50, fontSize: 58, lineHeight: 1.20, outlineWidth: 8, sourceLines: 5 },
  { version: 1, referenceId: "explore-wall-text-32", sourceSha256: "6dccb7e46ee73d10d3f9cca5ff56190c78a0464b9820d3ac89bb16dc501dd629", width: .78, y: .37, fontSize: 44, lineHeight: 1.20, outlineWidth: 1, sourceLines: 11 },
  { version: 1, referenceId: "explore-wall-text-33", sourceSha256: "71af32db165ba68bec6b0dc1cc6f1d0044377a642cf75a0c2da0c6943ba944a9", width: .76, y: .34, fontSize: 58, lineHeight: 1.22, outlineWidth: 7, sourceLines: 4, font: "robotocondensed" },
  { version: 1, referenceId: "explore-wall-text-34", sourceSha256: "88fe492cc435b59e2fd5698c8dba22c304cf6e3ee9b53f45884144999f088bcc", width: .84, y: .55, fontSize: 45, lineHeight: 1.20, outlineWidth: 7, sourceLines: 6 },
  { version: 1, referenceId: "explore-wall-text-35", sourceSha256: "fa40db0a291f888c7fe0951ba6390d08f32e5961ed145e28f123fbc9f9bffb8c", width: .85, y: .46, fontSize: 46, lineHeight: 1.20, outlineWidth: 1, sourceLines: 13, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-36", sourceSha256: "83e918dfda00ad022164c5a653a95a6ac13cada6980881293fd0a5b1c33a9697", width: .90, y: .12, fontSize: 44, lineHeight: 1.20, outlineWidth: 7, sourceLines: 6 },
  { version: 1, referenceId: "explore-wall-text-38", sourceSha256: "73901b6139a64929c670dbf8affe5d2f96fe70abca22049890a28ec0728a9d5f", width: .78, y: .30, fontSize: 38, lineHeight: 1.20, outlineWidth: 1, sourceLines: 8 },
  { version: 1, referenceId: "explore-wall-text-39", sourceSha256: "2bddafaee2e37b54e348387824581744a7964b4f25c71a16d8d5dac46528dadc", width: .84, y: .46, fontSize: 44, lineHeight: 1.20, outlineWidth: 1, sourceLines: 13, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-40", sourceSha256: "9c25ddf6f8cfa4b726149b19f89fcaf8e56ae437b0fa0b491f70461e8f31a79d", width: .86, y: .51, fontSize: 40, lineHeight: 1.20, outlineWidth: 1, sourceLines: 9, color: "#fff2a3" },
  { version: 1, referenceId: "explore-wall-text-41", sourceSha256: "7da7e852996e723a2a17d0176a266c9aacd32fb9e86da03d46f52fb407af8a4d", width: .72, y: .55, fontSize: 48, lineHeight: 1.20, outlineWidth: 1, sourceLines: 6 },
  { version: 1, referenceId: "explore-wall-text-43", sourceSha256: "ce5b2077deb17c46263e0f7360d003ed30dd9fc242e90875062cd2a8da17b2df", width: .68, y: .58, fontSize: 50, lineHeight: 1.18, outlineWidth: 1, sourceLines: 3 },
  { version: 1, referenceId: "explore-wall-text-46", sourceSha256: "e05dcd88203e6db2cb7ffa745b8b292da95adab90c7952abe1c0478a281a9e28", width: .70, y: .54, fontSize: 78, lineHeight: 1.20, outlineWidth: 1, sourceLines: 4, color: "#fff2a3" },
];
export function wallTextProfile(referenceId: string, sourceSha256?: string): WallTextProfile | null {
  const additional = additionalProfiles.find(item => item.referenceId === referenceId && (sourceSha256 === undefined || item.sourceSha256 === sourceSha256));
  if (additional) return { ...additional, ...(additional.regions ? { regions: additional.regions.map(region => ({ ...region })) } : {}) };
  const index = release.items.findIndex(item => item.id === referenceId && (sourceSha256 === undefined || item.videoSha256 === sourceSha256));
  const item = release.items[index], measured = measurements[index];
  return item && measured ? { version: 1, referenceId: item.id, sourceSha256: item.videoSha256, ...measured } : null;
}

/** Fit only a new untouched overlay. Existing words, breaks and saved styles
 * never pass through this initializer. Overflow is reviewable, not truncated. */
export function initialWallText(value: string, profile: WallTextProfile, durationMs: number, width = 1080, height = 1920): ExploreFormatText {
  const known = wallTextProfile(profile.referenceId, profile.sourceSha256);
  if (!known || JSON.stringify(known) !== JSON.stringify(profile)) throw new Error("This Wall layout profile could not be verified.");
  if (width / height < .54 || width / height > .59) throw new Error("Review Wall text placement for this aspect ratio.");
  const text: ExploreFormatText = { value, width: profile.width, y: profile.y, fontSize: profile.fontSize, lineHeight: profile.lineHeight,
    font: profile.font ?? "proximanovaa", fontWeight: profile.font === "robotocondensed" ? 400 : 600, outlineWidth: profile.outlineWidth, color: profile.color ?? "#ffffff", startMs: 0, endMs: durationMs, ...(profile.align ? { align: profile.align } : {}) };
  // Keep the reference size when it fits. Permit modest reduction, never the
  // Hook grow-to-fill behavior; dense copy is allowed to remain dense.
  const minSize = Math.max(Math.min(36, profile.fontSize), profile.fontSize * .85);
  while (text.fontSize >= minSize) {
    const layout = formatTextLayout(text, width, height);
    if (layout.fits && layout.lines.length <= Math.max(profile.sourceLines + 2, value.split("\n").length) &&
        text.y * height + layout.lines.length * layout.lineHeight <= height * .90) {
      return parseExploreFormatEdit({ version: 1, format: "wall_text", trimStartMs: 0, trimEndMs: durationMs, originalVolume: 1, musicVolume: .2, text }).text!;
    }
    text.fontSize -= 1;
  }
  throw new Error("Review the Wall text's fit before using this video.");
}

/** Separate source-defined regions, only for newly created structured plans. */
export function initialWallRegions(value: string, profile: WallTextProfile, durationMs: number): ExploreFormatText[] {
  const known = wallTextProfile(profile.referenceId, profile.sourceSha256);
  if (!known || JSON.stringify(known) !== JSON.stringify(profile) || !profile.regions) throw new Error("This Wall layout profile could not be verified.");
  const paragraphs = value.split(/\n\s*\n/u);
  if (paragraphs.length !== profile.regions.reduce((sum, region) => sum + region.paragraphs, 0)) throw new Error("Review the Wall text's separate regions before applying it.");
  let offset = 0;
  const layers = profile.regions.map(region => {
    const words = paragraphs.slice(offset, offset + region.paragraphs).join("\n\n"); offset += region.paragraphs;
    const text: ExploreFormatText = { value: words, width: region.width, y: region.y, fontSize: region.fontSize, lineHeight: profile.lineHeight, font: "proximanovaa", fontWeight: 600, color: region.color ?? profile.color ?? "#ffffff", outlineWidth: profile.outlineWidth, startMs: 0, endMs: durationMs, ...(region.align ? { align: region.align } : {}) };
    const min = Math.max(24, region.fontSize * .85);
    if (region.boxed) text.boxColor = text.color === "#000000" ? "#ffffff" : "#000000";
    while (text.fontSize >= min) {
      const layout = formatTextLayout(text, 1080, 1920);
      if (layout.fits && layout.lines.length <= region.sourceLines + 2) return text;
      text.fontSize--;
    }
    throw new Error("Review the Wall text's fit before applying its separate regions.");
  });
  for (let i = 0; i < layers.length - 1; i++) {
    const a = formatTextLayout(layers[i], 1080, 1920);
    if (a.y + a.lines.length * a.lineHeight > layers[i + 1].y * 1920) throw new Error("Review overlapping Wall text regions.");
  }
  return parseExploreFormatEdit({ version: 1, format: "wall_text", trimStartMs: 0, trimEndMs: durationMs, originalVolume: 1, musicVolume: .2, text: null, textOverlays: layers }).textOverlays!;
}

/** Separate source-defined regions, only for newly created structured plans. */
export function initialWallHeadingBody(heading: string, body: string, profile: WallTextProfile, durationMs: number, fitVersion?: 1): ExploreFormatText[] {
  const known = wallTextProfile(profile.referenceId, profile.sourceSha256);
  if (profile.structure !== "heading-body-v1" || !known || JSON.stringify(known) !== JSON.stringify(profile)) throw new Error("This Wall layout profile could not be verified.");
  const title: ExploreFormatText = { value: heading, width: .84, y: .11, fontSize: 65, lineHeight: 1.15, font: "proximanovaa", fontWeight: 600, outlineWidth: 8, color: "#ffffff", startMs: 0, endMs: durationMs };
  const content = initialWallText(body, profile, durationMs);
  const b = formatTextLayout(content, 1080, 1920);
  if (fitVersion === 1) {
    while (title.fontSize > 52 && formatTextLayout(title, 1080, 1920).lines.length > 1) title.fontSize -= 1;
  }
  const a = formatTextLayout(title, 1080, 1920);
  if (!a.fits || a.lines.length !== 1 || a.y + a.lineHeight > b.y) throw new Error("Review the Wall heading's fit before using this video.");
  return [title, content];
}
