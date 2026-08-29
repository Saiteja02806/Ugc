alter table public.avatar_assets
  add column if not exists hook_text_placement jsonb;

create temporary table hook_video_text_placement_v1 (
  source_file_sha256 text primary key,
  placement jsonb not null
) on commit drop;

insert into hook_video_text_placement_v1 (
  source_file_sha256,
  placement
)
values
  ('d780bfcbc2cc72adb71fc0442d2070b8a0b5969427d66cbfe25d4f0189d41512', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('dab0bd786fd492c1fc2050cc98cd4aef9c6b15dd1d5f4d0b008920939aaae5b6', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('b46d0ccb583fc51fa4945a032d8b077a20f8d089db57dd4ec23fe81d0b241b66', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('8468bd9c461885a66f96eb432477cffbf64d4e9eccf3710e2c16635c23174226', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('bb8ccd5c9c662fbc04880ab81d3ec3d0fe765d5872b4f538cb98b0ed1f5a9b8a', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('b6377b19216d84d642263217241d232163ca333829b47ab85fdeb60c26644c5a', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('754de87965a8b1807deef437e56b352787214d1be2aca03da34766b13ad0764e', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('e625ed93eb8e8e5bb416a277b149d2c3cee15ca9caeeb983336b40ddf0bd62dc', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('200d17b564a6e394bdb1dbf008ff988dc9b46b988dd6745a405e16e518579e47', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('c49650d7d4d814fe8f7c950b02c8458ba00e39a59c34e04e23f7016db60f925c', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('0085911726c56230af41716ba0fafa0ad828d6483b3977856896a6b15cd6a898', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('ca91ba4632c62e917eae8e840857087f3c96625d1edd74b063694fcade8306e4', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('5122e9f0c815320edf1fb39be539b6e30e036f3d04423c0f83307891773480d8', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('29116bce90430aad40eca967878cca6dd2498efdbf2dbf5b0fa2386678b6c0aa', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('432271acee28c623b2799a676e9c6563b7c90a4852de5c9875ebd0156b1086cd', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('3d74348761cb9d287f27f33c284b076deb150017c6bab50528e074d46bc00c6d', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('7eb6e65e602c10a17777a9198090efa64c7a68bcceacb271006c90bc2702cc30', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('f8a0bf77854d58a99ae2c7365a4e7b1b0bd7827fa6a51a41ed18ed72541849e7', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('1ac5084fc6f17ba311c8a8c48790bc238da49c6ac518371663c8ac2ebb0d9869', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('d0daa79b900937625b2da23df9ab53460478c62e1495c82d0d660d9a839b7719', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('500f46fbca2cb18203dbbdfa6e67be2a461ba28117ec7e90c2beda82f79bc9d7', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('0c57ee59a97be6a337878b0aa8a151acfbac11da577b13791875c0f2872e55f4', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('8a5929794211133186eb8a5d2bf3b5d21c6275849f2051ea4a5401bd603fabe1', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('06e62a51f08c9e83abc055b6b012f396df72125a6350bed2729b7aa251708037', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('60c7d085d5eac7c25d6090085f3de1b6489265b60285152ba41874cc96da6c2d', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('2884b1cd1d8c1cbc735819f68065365af2195972a46ce9a88d9e16512a001747', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('6751dacac7eed81a1850becdaf4ff601ecf8acb5e6c1f63da3cdf8b62202b9e4', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('a9f94ff7e65c810e5cc2fe2ea60757564d2104b76d95093b667b4472fa3ffabd', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('8cae432ff010ffcb9feb7e33077de39736263482f979880280babf5c6c273ddc', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('2aca0f5bba54af9f7354f5eb42c9813c19e9c22153cd2d4c26b059b64f6b6c6a', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('03d4a002033c06a3957458e933d00d7309bb83e8737f01726a52a0842738fa26', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('d4e30ff781d69406cab901aa64f172e44756fef71e70cec5fb48f63250baabf9', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('69eb56d03ce42a70f4dbfb497ec03fd686644407f8691b06ac69679574b0f01e', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('e9d577d254e76ceee1ef729417d76312af588fd741501be4a7d9e197fac7f170', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('c89ae5454b57978ce772b9dd1a045b5dcf54593cc76f97df7c739999338cfc04', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('4fa3ec75535c9e10644de505de88177189826b441bd2b957a69ba3124856d511', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('af484a224d49f0d333606964ac27186191dffc3528f2b5a9ae9435aa788586ab', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('e1d20f0d65945ed95557e9c7338df9c5e5813c374addc57c3744ff42a90cdcbc', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('c863d2050ce30aee5ee3b4281ff8de6a96db926e0652dcb36cf7b686aac3cf5b', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('5bc66b34064c4255bbe7bfc92ca5fc33a42180937fc881f60b47f808f6bbfb7b', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('256e1a4fccd26755d5a7d37b52b6eb6e634aabaf1367e9c91a518260cd4f3a84', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('6cf18354f099b8a9f92f64a7722cb68399f2ba8aa88444c2decb531a56d8db06', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('a4c8a7b03063e1f785517aeb9b6195fbb131140469392105ceeed449fbd0fa10', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('0c552cdf345ef6c61a7774003746763fab4dd76fefd200a47837d437bfbc2747', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('fdfc6ea8b7f876b2918d9180015952c443413219c39f609db620c7391d77ed91', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('5a0ccab16826c27dc49dc1495218016bf502eb6dc46740f0e59af77e70cf93ad', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('17b7b63578982b6aea006ea023990a2b3f7e04190512f1aa2600b4268fa20a37', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('fa7888172035606f55b9e9f1009b0ab64fee69bd73f45cec98b38bd9b614c4f2', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('02c648c4c32690d35ddf68b0e7ccadb65dba26f51f3e5ed99cdaf232f6b3eef8', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('6a7898bc5f26ecc67ee0f3919fc54411ba358d6b0725c67cf34e33a1c83185f0', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('9bf62ca6a13bd3a62e49a79ae133616ff80177caa4491046acebe32ac4fcb579', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('5ae0f1687ac90546d10433e15e7b31efc692a061d4ddd7fcc2813d28ff17d7ff', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('93147590a8f381f36296000a2015ae8b78826a4c25db4b27e97f59b2ecad2b37', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('e9364498af8ef5b0fbdc9b5ecf171cc6efff00769dad4eba386f8b6f4e158e4a', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('dda58d4fa050062c3a3e47df12e5e650b6da0c105f8abb1fd3d5860f19773bf4', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('5748e0117340ac252c5cde4e735da7a5d574f80ab3823e73bf5308f1bfd9b4a5', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('a8ad57326dc7b059c8d05707368ccc819d99b6b43ef7a0508aed10567aa463db', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('0dc02112c4dd1a2926cbd0c455f7b97ff41294034d457f612558c31d8c47a137', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('43c4260a6f45845e963ad7ae64cd3a4fb8278b688366ce894e81fff5035672db', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('b47b446193eee0378ab612c33cd97bd71df501535445c8bfe942e2b714cf71bd', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('a2b7a7568fa0e605952d21e36127b1100ff2ec3c12153da8dbc84a879afab2d0', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('7277c0eb58865cb281c3e2d8df1ab392416e42b2b378c563208f00ce856c0d91', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('56b09f5092f0dc06100aa36e19cb0e3013a7e1354892d4f0345ad1e1e9c287fc', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('8164b4b3bf91273c4415510e610ce4d7acbffadd5850503f99dfe85529c6a2d6', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('763b75010556935ec12333358abc4e0fa9cfbbb018fe3ae6cd8574f0711fdaad', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('967064d25f05820bafe349934bdcfb707cfc498271ada3427cad8c71cfff8ecb', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('5c48a0fa862dacc32bf3b3fbd1918a5794cb853ea771f2009bf4700c06956488', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('5302fc9514edfb6c6f9b186abd2a53328e036928b785126c124f83528e6a0916', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('25515023960a847ab949e6b36e0553d7bac7f10e4c3c7caca134be8e50aa9ed3', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('5a7ab419dda92ff26cbef41a5f61a39602a23f606f383f20a369b6b2c74331b5', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('3216138c406968fcaad78aebcf67620f201c2948c749cdad4cec6d3860ac6cd4', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('6a769162949afb2e1c85ed8929d100c7261d1760698bd25c8f05deceac5eafee', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('0d255a372fc42eec47ee4985a20a3cc848b04b640187a2f23937c8231875edd1', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('a9de7377a7b785942a23082be232f5d7c3dc5c637b1431a8bac57786b57bb6b8', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('b1bd61bb1ed5902cf2f0bfc8ed893d8ee0c16c76ba565127fa86a6484b8a9122', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('273511da30ac4f7e75755faef7621996d2033f24ac1068ef6de6748e41f83b8a', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('d4dd95ebe8270b585c398d22d0bb4f222fb7b88e9bc97506ace2781f81c07aaa', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('bc6753e5be1ed02771e8dd847316ada44aff8fc8e68e49278e98e0ec2b92ae19', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('f32a8bc0d5e02c6485cc392097d83dd52dd3792ebedba3b17e15dfe6cc1f5604', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('02b270a043829743c46f71375603505714ff047838c642a2fde7f7a42fa36bed', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('df08542c564c926fafe56368b0fd2d49272a8ab99d6078d155adb3898d45736c', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('90a3777d4e5c54d0cf93ca27cee7da482fd236a45e30a9dfa46aa07ffbb2a055', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('074efddffa760dc047a6bcc50865ebe694ef75266538c117653e02314b207d6c', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('6f4a765c65309974a95f225f3af6d88d8d541b2f171159942e31ed19d0daafd0', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('8e317460d86def9f11b645634e98512db33c908502e220c2e0f53ae87eed84ad', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('f6536963e14aafc179847118123460c2a165c98eaaa09fa50395ba7797339c24', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('bb4f567f0c3542888e8171ed4c20c2419e581ce55768eaa9f2db0c12f98929c9', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('e64d6fde08817016e89eccf23d4b426857e8581ed2d3024395caec984e84f32a', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('3a19aefb9aaae9669daff15f8834971c8540018cdb254379e1261430e67b14a8', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('443a86242e9e88ea22fa78d3b36b37b0fa5ee5a34ae74ba53b88e8d9d93a7d8e', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('b211ba4bba93a4878cd54c69298677a6084549bb60d59b577c510f27130d1a6f', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('241383399da67b162d62fc227db4b3096a0a87f4b9f54b097f3aee4b84adc886', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('79afba45c3eb7e1854a91b8071c79bc9ae9f70752676d8f7bc1d4a32de62734d', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('c24e6637b7bc627613625dacd25687c511ff8dcd9525c996105aa2ad142d16c7', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('8b1cc1570211629321e23336907370b88c8954ae2930427215922b6dd81d7271', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('001cfadfce595d2c1b12ba4a9cef42371486cef5526861ae7018d12f930484c6', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('e5170b56a16741d108a0e5d371bac49e6ae9280703b0708d2297da674286d48c', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('e87c5910d0608dc73cb2dcfc715c2cf1f918fb486cfcca69830d2dbd9c1b479b', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('18d1caba58c163cca9a34850fd276b5e0c4893425fd9ee83c7d7e7bca5a08188', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('d3ba62e9edca3cdc82265764971b2ba53e1e5a05e42849245ecd56d63c77b454', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('74cd3345580efe1de7dc65dcde93f1fbb3ae8f435e160ce8038080a2eb488e2e', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('abe15bf75cd1537892f07c2e00000734ae09fb4a0c46ff6a41d4d3f0aaed68f4', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('966acacf1341ddb151e14fc84da258588cd22290f2f691bb3c76a692fc003cf1', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('63f238abed607b1020309efcee603352979120fdedeeebd3a721eff68c780ea8', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('d641d77096f3abc59a59b37aeb4c4dd3a874c6eee6a41cbe67e7d6f9b591d061', '{"preset":"below_face","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.68}'::jsonb),
  ('751e36927a6e0eec5562308ce03eab176e9f0f1513a768d97f6a75a1aa2deae8', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb),
  ('7851a78d9eac288c787792907f7ec29749e08b4cb83aaacaaa7084739956d702', '{"preset":"above_head","reviewVersion":"hook-first-frame-placement-v1","reviewedAt":"2026-08-19","x":0.5,"y":0.15}'::jsonb);

do $$
begin
  if (select count(*) from hook_video_text_placement_v1) <> 107 then
    raise exception 'hook_video_text_placement_v1_manifest_count_mismatch';
  end if;

  if exists (
    select 1
    from hook_video_text_placement_v1 as mapping
    left join public.avatar_assets as asset
      on asset.source_file_sha256 = mapping.source_file_sha256
      and asset.deleted_at is null
    where asset.id is null
  ) then
    raise exception 'hook_video_text_placement_v1_asset_missing';
  end if;
end
$$;

update public.avatar_assets as asset
set
  hook_text_placement = mapping.placement,
  updated_at = now()
from hook_video_text_placement_v1 as mapping
where asset.source_file_sha256 = mapping.source_file_sha256
  and asset.deleted_at is null
  and asset.hook_text_placement is distinct from mapping.placement;

do $$
begin
  if (
    select count(*)
    from public.avatar_assets as asset
    join hook_video_text_placement_v1 as mapping
      on mapping.source_file_sha256 = asset.source_file_sha256
    where asset.deleted_at is null
      and asset.hook_text_placement = mapping.placement
  ) <> 107 then
    raise exception 'hook_video_text_placement_v1_backfill_incomplete';
  end if;
end
$$;

alter table public.avatar_assets
  drop constraint if exists avatar_assets_hook_text_placement_chk,
  add constraint avatar_assets_hook_text_placement_chk check (
    hook_text_placement is null
    or (
      jsonb_typeof(hook_text_placement) = 'object'
      and hook_text_placement ->> 'preset' in ('above_head', 'below_face')
      and jsonb_typeof(hook_text_placement -> 'x') = 'number'
      and (hook_text_placement ->> 'x')::numeric between 0 and 1
      and jsonb_typeof(hook_text_placement -> 'y') = 'number'
      and (hook_text_placement ->> 'y')::numeric between 0 and 1
      and char_length(trim(coalesce(hook_text_placement ->> 'reviewVersion', '')))
        between 1 and 100
      and char_length(trim(coalesce(hook_text_placement ->> 'reviewedAt', '')))
        between 10 and 40
    )
  ),
  drop constraint if exists avatar_assets_ready_hook_text_placement_chk,
  add constraint avatar_assets_ready_hook_text_placement_chk check (
    status <> 'ready'
    or deleted_at is not null
    or source_batch not like 'hook-silent-%'
    or hook_text_placement is not null
  );

comment on column public.avatar_assets.hook_text_placement is
  'First-frame-reviewed normalized center anchor for Hook overlay text. Catalog placement is the default; a saved user edit may override it.';

select pg_notify('pgrst', 'reload schema');

