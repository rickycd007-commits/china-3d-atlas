// Comprehensive Authoritative Catalog of Chinese Geography:
// 34 Provincial-Level Divisions + Capitals, 22 Major Mountain Ranges, Major Rivers & Lakes, Climatic Divides

export const PROVINCE_CATALOG = [
  { adcode: 110000, short: '北京', abbr: '京', capital: '北京', capLonLat: [116.4074, 39.9042], climate: '温带季风气候', janT: -3.1, julT: 26.7, precip: 585, landform: '华北平原西北隅，背靠燕山与太行山余脉（西山），地势西北高东南低。' },
  { adcode: 120000, short: '天津', abbr: '津', capital: '天津', capLonLat: [117.2010, 39.0842], climate: '温带季风气候', janT: -2.8, julT: 27.0, precip: 550, landform: '海河五大支流汇流处，东临渤海湾，北部为燕山南麓盘山山地，大部为冲积平原。' },
  { adcode: 130000, short: '河北', abbr: '冀', capital: '石家庄', capLonLat: [114.5149, 38.0428], climate: '温带季风气候', janT: -2.2, julT: 26.8, precip: 520, landform: '兼备高原（坝上）、山地（太行山、燕山）、丘陵、盆地、平原与渤海滨海，唯一地貌齐全省份。' },
  { adcode: 140000, short: '山西', abbr: '晋', capital: '太原', capLonLat: [112.5489, 37.8706], climate: '温带季风/大陆性过渡', janT: -5.0, julT: 23.8, precip: 480, landform: '“表里山河”，东倚太行、西临吕梁与黄河峡谷，中部串珠状分布大同、忻定、太原、临汾、运城盆地。' },
  { adcode: 150000, short: '内蒙古', abbr: '蒙', capital: '呼和浩特', capLonLat: [111.7492, 40.8426], climate: '温带大陆性气候', janT: -11.5, julT: 22.4, precip: 310, landform: '横跨东北、华北、西北，主体为内蒙古高原，东起大兴安岭，中亘阴山、贺兰山，草原与戈壁广布。' },
  { adcode: 210000, short: '辽宁', abbr: '辽', capital: '沈阳', capLonLat: [123.4315, 41.8057], climate: '温带季风气候', janT: -10.8, julT: 24.9, precip: 680, landform: '“六山一水三分田”，东西两侧为千山（长白山余脉）与辽西丘陵，中部为辽河冲积平原，南临渤海与黄海。' },
  { adcode: 220000, short: '吉林', abbr: '吉', capital: '长春', capLonLat: [125.3235, 43.8171], climate: '温带季风气候', janT: -14.7, julT: 23.2, precip: 610, landform: '东南部长白山脉巍峨耸立（主峰火山天池），中西部展开辽阔肥沃的松嫩黑土平原。' },
  { adcode: 230000, short: '黑龙江', abbr: '黑', capital: '哈尔滨', capLonLat: [126.5350, 45.8038], climate: '寒温带/温带季风气候', janT: -18.3, julT: 22.8, precip: 530, landform: '“五山一水一草三分田”，大兴安岭、小兴安岭与张广才岭环抱松嫩平原与三江平原，界江黑龙江、乌苏里江奔流。' },
  { adcode: 310000, short: '上海', abbr: '沪', capital: '上海', capLonLat: [121.4737, 31.2304], climate: '亚热带季风气候', janT: 4.9, julT: 28.8, precip: 1180, landform: '长江入海口冲积平原与崇明河口沙岛，河网密布，西接太湖流域，东濒东海。' },
  { adcode: 320000, short: '江苏', abbr: '苏', capital: '南京', capLonLat: [118.7969, 32.0603], climate: '亚热带与温带季风过渡', janT: 2.7, julT: 28.1, precip: 1050, landform: '全国地势最为低平省份，长江与京杭大运河十字交汇，坐拥太湖、洪泽湖，淮河横贯苏北。' },
  { adcode: 330000, short: '浙江', abbr: '浙', capital: '杭州', capLonLat: [120.1551, 30.2741], climate: '亚热带季风气候', janT: 4.8, julT: 28.9, precip: 1450, landform: '“七山一水二分田”，浙北杭嘉湖平原水乡泽国，浙南天目山、仙霞岭、括苍山丘陵起伏，东海岛屿星罗棋布。' },
  { adcode: 340000, short: '安徽', abbr: '皖', capital: '合肥', capLonLat: [117.2272, 31.8206], climate: '暖温带与亚热带季风过渡', janT: 2.8, julT: 28.3, precip: 1100, landform: '长江、淮河横贯全省，自然切分为皖北淮北平原、江淮丘陵与皖南黄山—九华山山地三大地理单元。' },
  { adcode: 350000, short: '福建', abbr: '闽', capital: '福州', capLonLat: [119.2965, 26.0745], climate: '亚热带季风气候', janT: 10.9, julT: 28.9, precip: 1650, landform: '“八山一水一分田”，西列武夷山脉、中列鹫峰—戴云山脉，闽江穿峡入海，海岸线曲折深邃，隔台湾海峡望台湾。' },
  { adcode: 360000, short: '江西', abbr: '赣', capital: '南昌', capLonLat: [115.8582, 28.6829], climate: '亚热带季风气候', janT: 5.5, julT: 29.3, precip: 1620, landform: '东、西、南三面环山（武夷山、罗霄山、南岭），赣江等五水汇入北部中国第一大淡水湖——鄱阳湖盆地。' },
  { adcode: 370000, short: '山东', abbr: '鲁', capital: '济南', capLonLat: [117.1201, 36.6512], climate: '温带季风气候', janT: -0.8, julT: 27.2, precip: 680, landform: '鲁中泰山、沂蒙山突起（“五岳独尊”），鲁西北为黄河三角洲与华北冲积平原，山东半岛深入渤海与黄海之间。' },
  { adcode: 410000, short: '河南', abbr: '豫', capital: '郑州', capLonLat: [113.6253, 34.7466], climate: '暖温带向亚热带过渡', janT: 0.5, julT: 27.5, precip: 690, landform: '地跨二、三级阶梯，西倚太行、伏牛、桐柏、大别四山，中东部展开辽阔黄淮海冲积大平原，黄河自洛阳出峡悬河东去。' },
  { adcode: 420000, short: '湖北', abbr: '鄂', capital: '武汉', capLonLat: [114.3054, 30.5931], climate: '亚热带季风气候', janT: 4.0, julT: 29.1, precip: 1210, landform: '西耸巫山、神农架与武当山（长江三峡锁钥），中南部为“千湖之省”江汉平原，长江与最大支流汉江交汇于武汉。' },
  { adcode: 430000, short: '湖南', abbr: '湘', capital: '长沙', capLonLat: [112.9388, 28.2282], climate: '亚热带季风气候', janT: 4.9, julT: 29.2, precip: 1430, landform: '西亘雪峰山、武陵山（二三级阶梯界山），南屏南岭，湘资沅澧四水北注洞庭湖，呈朝北敞开的马蹄形盆地。' },
  { adcode: 440000, short: '广东', abbr: '粤', capital: '广州', capLonLat: [113.2644, 23.1291], climate: '亚热带/热带季风气候', janT: 13.8, julT: 28.7, precip: 1780, landform: '北依南岭屏障，西江、北江、东江汇成丰饶的珠江三角洲，南伸雷州半岛，大陆海岸线居全国之首。' },
  { adcode: 450000, short: '广西', abbr: '桂', capital: '南宁', capLonLat: [108.3665, 22.8170], climate: '亚热带/热带季风气候', janT: 12.9, julT: 28.4, precip: 1580, landform: '云贵高原东南边缘广西盆地，世界级峰林峰丛喀斯特地貌（桂林漓江），西江干流红水河—浔江横贯，南濒北部湾。' },
  { adcode: 460000, short: '海南', abbr: '琼', capital: '海口', capLonLat: [110.1999, 20.0440], climate: '热带季风/海洋性气候', janT: 18.2, julT: 28.6, precip: 1850, landform: '海南本岛中部五指山、鹦哥岭穹隆突起，水系放射入海；辖西沙、中沙、南沙群岛及广阔南海海域。' },
  { adcode: 500000, short: '重庆', abbr: '渝', capital: '重庆', capLonLat: [106.5516, 29.5630], climate: '亚热带季风湿润气候', janT: 7.9, julT: 28.9, precip: 1150, landform: '典型“山城江城”，北有大巴山、东有巫山、东南武陵山，川东平行岭谷褶皱鲜明，长江与嘉陵江交汇穿城。' },
  { adcode: 510000, short: '四川', abbr: '川', capital: '成都', capLonLat: [104.0665, 30.5723], climate: '亚热带季风与高原山地气候', janT: 5.8, julT: 25.6, precip: 980, landform: '东西地貌极致反差：西部为川西横断高山峡谷与贡嘎雪山（7556m），东部为紫红砂岩环抱的沃野“天府”四川盆地。' },
  { adcode: 520000, short: '贵州', abbr: '黔', capital: '贵阳', capLonLat: [106.6302, 26.6477], climate: '亚热带湿润季风气候', janT: 5.1, julT: 23.9, precip: 1180, landform: '居云贵高原东斜坡，“地无三尺平”，乌蒙山、苗岭、大娄山绵延，喀斯特峡谷、溶洞与黄果树瀑布举世闻名。' },
  { adcode: 530000, short: '云南', abbr: '滇', capital: '昆明', capLonLat: [102.8329, 24.8801], climate: '亚热带/热带高原季风', janT: 9.2, julT: 20.2, precip: 1080, landform: '西北横断山脉“三江并流”（怒江、澜沧江、金沙江高山深谷），中部滇中高原湖盆（滇池、洱海），南部西双版纳热带雨林。' },
  { adcode: 540000, short: '西藏', abbr: '藏', capital: '拉萨', capLonLat: [91.1409, 29.6456], climate: '高原山地气候', janT: -1.6, julT: 16.2, precip: 430, landform: '“世界屋脊”主体，平均海拔4000米以上，喜马拉雅（珠峰8848.86m）、冈底斯、念青唐古拉、昆仑环峙，雅鲁藏布江劈开世界第一大峡谷。' },
  { adcode: 610000, short: '陕西', abbr: '陕', capital: '西安', capLonLat: [108.9398, 34.3416], climate: '温带大陆性/季风与亚热带跨区', janT: 0.3, julT: 26.9, precip: 620, landform: '纵跨三大自然区：陕北黄土高原千沟万壑、关中渭河平原“八百里秦川”、陕南秦巴山地（秦岭为中国南北总分界）。' },
  { adcode: 620000, short: '甘肃', abbr: '甘', capital: '兰州', capLonLat: [103.8343, 36.0611], climate: '温带大陆性干旱/半干旱', janT: -5.3, julT: 22.8, precip: 320, landform: '宛如玉如意横跨三大高原交汇带，祁连山冰川融水滋养狭长1000公里的丝路咽喉——河西走廊，黄河唯一穿城省会兰州。' },
  { adcode: 630000, short: '青海', abbr: '青', capital: '西宁', capLonLat: [101.7782, 36.6171], climate: '高原大陆性气候', janT: -7.4, julT: 17.3, precip: 380, landform: '“中华水塔”三江源（长江、黄河、澜沧江发源地），北亘祁连山、南列唐古拉与巴颜喀拉山，西北嵌“聚宝盆”柴达木盆地与青海湖。' },
  { adcode: 640000, short: '宁夏', abbr: '宁', capital: '银川', capLonLat: [106.2309, 38.4872], climate: '温带大陆性半干旱/干旱', janT: -7.5, julT: 23.8, precip: 260, landform: '西屏巍峨贺兰山抵御腾格里风沙，黄河自中卫入宁造就“塞上江南”银川平原，南部为六盘山与黄土丘陵。' },
  { adcode: 650000, short: '新疆', abbr: '新', capital: '乌鲁木齐', capLonLat: [87.6168, 43.8256], climate: '温带大陆性干旱气候', janT: -12.2, julT: 24.2, precip: 165, landform: '“三山夹两盆”经典格局：北阿尔泰山、中天山、南昆仑—喀喇昆仑山，怀抱准噶尔盆地与塔里木盆地（塔克拉玛干沙漠及吐鲁番洼地-154m）。' },
  { adcode: 710000, short: '台湾', abbr: '台', capital: '台北', capLonLat: [121.5654, 25.0330], climate: '亚热带与热带季风气候', janT: 16.1, julT: 29.6, precip: 2450, landform: '祖国第一大岛，中央山脉、玉山山脉（主峰玉山3952m，我国东部最高峰）纵贯南北，东岸断崖陡入太平洋，西岸为嘉南平原。' },
  { adcode: 810000, short: '香港', abbr: '港', capital: '香港', capLonLat: [114.1694, 22.3193], climate: '亚热带海洋性季风气候', janT: 16.3, julT: 28.8, precip: 2390, landform: '珠江口东侧，由香港岛、九龙半岛、新界及260余外岛组成，维多利亚港水深港阔，山地丘陵直逼海湾。' },
  { adcode: 820000, short: '澳门', abbr: '澳', capital: '澳门', capLonLat: [113.5439, 22.1987], climate: '亚热带海洋性季风气候', janT: 15.2, julT: 28.6, precip: 2050, landform: '珠江口西岸，由澳门半岛、氹仔岛和路环岛组成，西江泥沙冲积与现代填海相融，滨海风貌精致。' },
];

export const MOUNTAIN_RANGES = [
  {
    id: 'himalaya', name: '喜马拉雅山脉', peak: '珠穆朗玛峰', elev: 8848.86, tier: 1,
    role: '世界海拔最高山脉 · 阻挡印度洋暖湿气流北上',
    spine: [[79.2, 31.6], [81.6, 30.2], [84.2, 28.7], [86.925, 27.988], [89.2, 27.8], [92.0, 28.1], [95.0, 29.6]],
    peakLonLat: [86.925, 27.988]
  },
  {
    id: 'kunlun', name: '昆仑山脉', peak: '公格尔峰 / 玉珠峰', elev: 7649, tier: 1,
    role: '“万山之祖” · 地势第一、二级阶梯北界',
    spine: [[75.3, 38.6], [78.8, 36.2], [82.5, 36.1], [86.8, 36.3], [90.8, 36.0], [94.8, 35.7], [98.2, 35.5]],
    peakLonLat: [75.31, 38.59]
  },
  {
    id: 'tianshan', name: '天山山脉', peak: '托木尔峰', elev: 7443, tier: 1,
    role: '横亘新疆中部 · 分隔准噶尔与塔里木两大盆地',
    spine: [[78.5, 41.5], [80.1, 42.04], [83.5, 42.9], [86.8, 43.4], [88.3, 43.8], [91.8, 43.3], [94.2, 43.1]],
    peakLonLat: [80.12, 42.04]
  },
  {
    id: 'karakoram', name: '喀喇昆仑山脉', peak: '乔戈里峰 (K2)', elev: 8611, tier: 1,
    role: '世界第二高峰所在地 · 极高山现代冰川发育中心',
    spine: [[74.8, 36.8], [76.51, 35.88], [78.2, 35.1], [79.6, 34.3]],
    peakLonLat: [76.513, 35.881]
  },
  {
    id: 'altai', name: '阿尔泰山脉', peak: '友谊峰', elev: 4374, tier: 2,
    role: '西北界山 · 额尔齐斯河发源地',
    spine: [[86.8, 49.0], [87.82, 49.14], [89.2, 48.0], [90.6, 46.8]],
    peakLonLat: [87.82, 49.14]
  },
  {
    id: 'qilian', name: '祁连山脉', peak: '团结峰', elev: 5808, tier: 1,
    role: '第一、二级阶梯分界 · 河西走廊绿洲生命之源',
    spine: [[94.8, 39.3], [97.6, 38.5], [99.8, 38.1], [102.2, 37.3]],
    peakLonLat: [97.62, 38.51]
  },
  {
    id: 'tanggula', name: '唐古拉山脉', peak: '各拉丹冬峰', elev: 6621, tier: 1,
    role: '长江正源沱沱河发源地 · 青海与西藏界山',
    spine: [[88.8, 33.4], [91.1, 33.5], [93.2, 32.8], [95.2, 32.1]],
    peakLonLat: [91.10, 33.50]
  },
  {
    id: 'gangdise', name: '冈底斯山脉', peak: '冈仁波齐 / 冷布岗日', elev: 7095, tier: 1,
    role: '外流区与藏北羌塘内流区分界 · 200mm等降水量线西段',
    spine: [[81.3, 31.0], [83.8, 30.4], [85.3, 30.0], [88.2, 29.8]],
    peakLonLat: [81.31, 31.07]
  },
  {
    id: 'bayanhar', name: '巴颜喀拉山脉', peak: '勒那冬则', elev: 5267, tier: 2,
    role: '黄河发源地 · 长江与黄河水系天然分水岭',
    spine: [[95.5, 34.8], [97.8, 34.2], [99.8, 33.7], [101.5, 33.3]],
    peakLonLat: [97.8, 34.2]
  },
  {
    id: 'hengduan', name: '横断山脉', peak: '贡嘎山', elev: 7556, tier: 1,
    role: '第一、二级阶梯东界 · 唯一南北纵贯高山深谷“三江并流”',
    spine: [[98.2, 31.8], [99.2, 29.8], [101.88, 29.60], [100.2, 27.5], [99.6, 25.5]],
    peakLonLat: [101.88, 29.60]
  },
  {
    id: 'qinling', name: '秦岭', peak: '太白山', elev: 3771.2, tier: 1,
    role: '华夏龙脉 · 中国南北地理与气候总分界（1月0℃/800mm线）',
    spine: [[105.2, 33.9], [107.77, 33.96], [109.5, 33.85], [111.5, 33.8]],
    peakLonLat: [107.77, 33.96]
  },
  {
    id: 'daxingan', name: '大兴安岭', peak: '黄岗梁', elev: 2029, tier: 1,
    role: '第二、三级阶梯北界 · 400mm等降水量线与季风区西界',
    spine: [[122.5, 52.3], [121.2, 50.2], [120.2, 47.8], [118.8, 45.5], [117.5, 43.6]],
    peakLonLat: [117.5, 43.6]
  },
  {
    id: 'xiaoxingan', name: '小兴安岭', peak: '平顶山', elev: 1429, tier: 2,
    role: '黑龙江与松花江分水岭 · 北国红松故乡',
    spine: [[126.2, 49.5], [127.8, 48.2], [129.0, 47.0]],
    peakLonLat: [128.2, 47.8]
  },
  {
    id: 'changbai', name: '长白山脉', peak: '长白山天池峰丛', elev: 2691, tier: 1,
    role: '松花江、鸭绿江、图们江三江之源 · 休眠火山口湖天池',
    spine: [[129.8, 44.2], [128.06, 42.00], [125.8, 40.9], [123.5, 40.2]],
    peakLonLat: [128.06, 42.00]
  },
  {
    id: 'taihang', name: '太行山脉', peak: '小五台山', elev: 2882, tier: 1,
    role: '第二、三级阶梯中段界山 · 黄土高原与华北平原天然屏障',
    spine: [[115.0, 39.9], [114.1, 38.2], [113.6, 36.6], [113.1, 35.3]],
    peakLonLat: [115.0, 39.88]
  },
  {
    id: 'yinshan', name: '阴山山脉', peak: '呼和巴什格', elev: 2364, tier: 2,
    role: '季风北界屏障 · 内蒙古高原与河套平原分界',
    spine: [[106.8, 41.2], [109.2, 41.1], [111.5, 41.0], [113.5, 41.2]],
    peakLonLat: [107.5, 41.2]
  },
  {
    id: 'helan', name: '贺兰山', peak: '敖包疙瘩', elev: 3556, tier: 2,
    role: '200mm等降水量线标志山脉 · 守护银川“塞上江南”',
    spine: [[106.2, 39.2], [105.9, 38.6], [105.8, 37.9]],
    peakLonLat: [105.92, 38.75]
  },
  {
    id: 'wushan', name: '巫山', peak: '神女峰 / 葱坪', elev: 2796, tier: 2,
    role: '第二、三级阶梯分界 · 长江横切形成壮丽三峡',
    spine: [[110.2, 31.6], [109.9, 30.8], [109.5, 30.0]],
    peakLonLat: [110.0, 31.05]
  },
  {
    id: 'xuefeng', name: '雪峰山', peak: '苏宝顶', elev: 1934, tier: 2,
    role: '第二、三级阶梯南段界山 · 云贵高原向江南丘陵过渡带',
    spine: [[111.2, 28.5], [110.6, 27.3], [110.1, 26.2]],
    peakLonLat: [110.55, 27.25]
  },
  {
    id: 'wuyi', name: '武夷山脉', peak: '黄岗山', elev: 2158, tier: 2,
    role: '江西与福建界山 · 世界文化与自然双遗产丹霞地貌',
    spine: [[118.4, 28.2], [117.78, 27.86], [116.8, 26.5], [116.0, 25.3]],
    peakLonLat: [117.78, 27.86]
  },
  {
    id: 'nanling', name: '南岭', peak: '猫儿山', elev: 2142, tier: 2,
    role: '长江水系与珠江水系分水岭 · 华中与华南天然界山',
    spine: [[110.4, 25.9], [112.2, 25.3], [113.8, 25.2], [115.2, 25.3]],
    peakLonLat: [110.42, 25.88]
  },
  {
    id: 'taiwan_range', name: '台湾山脉 · 玉山', peak: '玉山主峰', elev: 3952, tier: 1,
    role: '中国东部最高峰 · 太平洋板块与亚欧板块碰撞抬升脊梁',
    spine: [[121.6, 24.6], [121.2, 23.9], [120.957, 23.470], [120.8, 22.6]],
    peakLonLat: [120.957, 23.470]
  },
];

export const RIVER_SYSTEMS = [
  {
    id: 'yangtze', name: '长江', en: 'Yangtze River', lengthKm: 6300, basinKm2: 1800000,
    origin: '唐古拉山脉各拉丹冬峰西南侧（沱沱河）', outlet: '东海',
    role: '中国第一大河、世界第三长河，横贯三级阶梯十一省区市',
    color: '#36d6e7', primary: true,
    neNames: ['Tuotuo', 'Tongtian', 'Jinsha', 'Chang Jiang', 'Yangtze']
  },
  {
    id: 'yellow', name: '黄河', en: 'Yellow River', lengthKm: 5464, basinKm2: 795000,
    origin: '青海巴颜喀拉山北麓约古宗列盆地', outlet: '渤海',
    role: '中华民族母亲河，中国第二长河，塑造河套平原与华北平原',
    color: '#f5b942', primary: true,
    neNames: ['Huang']
  },
  {
    id: 'pearl', name: '珠江', en: 'Pearl River', lengthKm: 2320, basinKm2: 453700,
    origin: '云南曲靖马雄山（南盘江）', outlet: '南海',
    role: '中国年径流量第二大河，由西江、北江、东江汇入珠三角网河区',
    color: '#38e8b0', primary: true,
    neNames: ['Nanpan', 'Hongshui', 'Xun', 'Xi', 'Bei', 'Dong']
  },
  {
    id: 'heilongjiang', name: '黑龙江', en: 'Heilongjiang (Amur)', lengthKm: 4440, basinKm2: 1855000,
    origin: '额尔古纳河（海拉尔河）与石勒喀河汇合', outlet: '鄂霍次克海/鞑靼海峡',
    role: '中俄北方浩荡界江，流域森林黑土丰饶',
    color: '#57b8ff', primary: true,
    neNames: ['Hailar', 'Argun’', 'Amur', 'Heilong Jiang']
  },
  {
    id: 'songhua', name: '松花江', en: 'Songhua River', lengthKm: 2308, basinKm2: 557200,
    origin: '长白山天池（南源）与大兴安岭伊勒呼里山（嫩江北源）', outlet: '汇入黑龙江',
    role: '东北平原核心水脉，滋养松嫩与三江两大粮仓',
    color: '#64c9ff', primary: true,
    neNames: ['Songhua']
  },
  {
    id: 'yarlung', name: '雅鲁藏布江', en: 'Yarlung Tsangpo', lengthKm: 2057, basinKm2: 240480,
    origin: '喜马拉雅山北麓杰马央宗冰川', outlet: '经墨脱大拐弯出境注入孟加拉湾',
    role: '世界海拔最高大河，绕南迦巴瓦峰切出世界第一大峡谷',
    color: '#46e2ff', primary: true,
    neNames: ['Maquan', 'Yarlung']
  },
  {
    id: 'lancang', name: '澜沧江', en: 'Lancang (Mekong)', lengthKm: 2161, basinKm2: 167400,
    origin: '青海玉树杂多县吉富山（扎曲）', outlet: '出境称湄公河注入南海',
    role: '东方多瑙河上游，穿行横断山脉高山深谷',
    color: '#43d0df', primary: true,
    neNames: ['Za', 'Lancang']
  },
  {
    id: 'nujiang', name: '怒江', en: 'Nujiang (Salween)', lengthKm: 2013, basinKm2: 137800,
    origin: '唐古拉山南麓那曲嘉玉桥', outlet: '出境称萨尔温江注入安达曼海',
    role: '三江并流西支，峡谷幽深落差巨大',
    color: '#4abbe8', primary: false,
    neNames: ['Nu']
  },
  {
    id: 'tarim', name: '塔里木河', en: 'Tarim River', lengthKm: 2179, basinKm2: 1020000,
    origin: '喀喇昆仑山叶尔羌河与天山阿克苏河汇流', outlet: '台特玛湖（内流河）',
    role: '中国第一大内流河，环绕塔克拉玛干沙漠北缘孕育胡杨绿洲',
    color: '#e8c468', primary: true,
    neNames: ['Yarkant', 'Tarim', 'Konqi']
  },
  {
    id: 'huaihe', name: '淮河', en: 'Huaihe River', lengthKm: 1000, basinKm2: 270000,
    origin: '河南桐柏山太白顶', outlet: '经洪泽湖入江入海',
    role: '与秦岭共同构成中国南北自然地理分界线',
    color: '#4fd8c8', primary: true,
    neNames: ['Huai']
  },
  {
    id: 'haihe', name: '海河', en: 'Haihe River', lengthKm: 1050, basinKm2: 318200,
    origin: '太行山、燕山五大支流（永定河等）汇于天津', outlet: '渤海',
    role: '华北最大水系，扇形水网润泽京津冀',
    color: '#5ec7f2', primary: false,
    neNames: ['Sanggan', 'Yongding', 'Hai']
  },
  {
    id: 'liaohe', name: '辽河', en: 'Liaohe River', lengthKm: 1390, basinKm2: 219000,
    origin: '河北七老图山（西辽河）与吉林哈达岭（东辽河）', outlet: '渤海辽东湾',
    role: '东北南部母亲河，冲积形成辽河平原',
    color: '#5fc5ed', primary: false,
    neNames: ['Xar Moron', 'Xiliao', 'Liao']
  },
  {
    id: 'irtysh', name: '额尔齐斯河', en: 'Irtysh River', lengthKm: 633, basinKm2: 57000,
    origin: '新疆阿尔泰山南坡富蕴县', outlet: '经鄂毕河注入北冰洋',
    role: '中国唯一注入北冰洋的外流河',
    color: '#7cd8ff', primary: false,
    neNames: ['Ertix', 'Ertis']
  },
  {
    id: 'grand_canal', name: '京杭大运河', en: 'Beijing-Hangzhou Grand Canal', lengthKm: 1794, basinKm2: 0,
    origin: '北京通州', outlet: '浙江杭州（沟通海、黄、淮、长、钱塘五大水系）',
    role: '世界上里程最长、工程最大的古代运河，世界文化遗产',
    color: '#88e9ff', primary: true,
    customCoords: [
      [116.65, 39.90], [117.18, 39.12], [116.85, 38.30], [116.30, 37.45],
      [115.98, 36.45], [116.58, 35.42], [117.15, 34.78], [117.95, 34.10],
      [118.98, 33.55], [119.42, 32.40], [119.95, 31.80], [120.30, 31.56],
      [120.60, 31.30], [120.16, 30.28]
    ]
  }
];

export const MAJOR_LAKES = [
  { name: '青海湖', lonLat: [100.20, 36.88], type: '咸水湖', desc: '中国面积最大湖泊（4625 km²）' },
  { name: '鄱阳湖', lonLat: [116.28, 29.08], type: '淡水湖', desc: '中国第一大淡水湖，吞吐长江洪枯' },
  { name: '洞庭湖', lonLat: [112.92, 29.15], type: '淡水湖', desc: '“八百里洞庭”，中国第二大淡水湖' },
  { name: '太湖', lonLat: [120.22, 31.22], type: '淡水湖', desc: '江南鱼米之乡明珠，中国第三大淡水湖' },
  { name: '洪泽湖', lonLat: [118.62, 33.32], type: '淡水湖', desc: '淮河中下游关键调蓄大湖' },
  { name: '呼伦湖', lonLat: [117.42, 48.95], type: '淡水湖', desc: '呼伦贝尔大草原苍茫内陆巨浸' },
  { name: '纳木错', lonLat: [90.62, 30.72], type: '高原咸水湖', desc: '念青唐古拉山北麓“天湖”（海拔4718m）' },
  { name: '色林错', lonLat: [88.98, 31.80], type: '高原咸水湖', desc: '西藏第一大湖泊，羌塘高原生态核心' },
  { name: '博斯腾湖', lonLat: [87.05, 41.98], type: '内陆吞吐淡水湖', desc: '天山南麓最大内陆淡水湖' },
];

export const CLIMATIC_DIVIDES = [
  {
    id: 'qinling_huaihe',
    name: '秦岭—淮河线（1月0℃ / 800mm线）',
    desc: '亚热带与暖温带、湿润与半湿润、南方水田与北方旱地总分界',
    color: '#ff7b54',
    coords: [[104.2, 33.7], [106.5, 33.9], [108.8, 33.85], [111.2, 33.7], [113.5, 32.9], [115.6, 32.5], [117.8, 32.9], [119.5, 33.8], [120.4, 34.1]]
  },
  {
    id: 'isohyet_400',
    name: '400mm 等降水量线（季风/非季风界）',
    desc: '大兴安岭—张家口—兰州—拉萨一线，半湿润与半干旱、农耕与游牧文明分界',
    color: '#4de8b2',
    coords: [[121.8, 52.0], [120.3, 48.5], [118.2, 44.5], [115.0, 40.9], [111.5, 39.2], [107.8, 37.2], [103.8, 36.0], [99.8, 33.8], [95.6, 31.4], [91.2, 29.6], [88.5, 28.0]]
  },
  {
    id: 'isohyet_200',
    name: '200mm 等降水量线（半干旱/干旱界）',
    desc: '阴山—贺兰山—祁连山—巴颜喀拉山—冈底斯山一线',
    color: '#ffd166',
    coords: [[112.5, 42.2], [108.5, 41.2], [106.0, 39.0], [102.5, 37.6], [98.0, 35.8], [93.5, 33.6], [88.0, 31.2], [82.0, 30.8]]
  },
  {
    id: 'step_1_2',
    name: '地势第一、二级阶梯分界线',
    desc: '昆仑山脉—阿尔金山脉—祁连山脉—横断山脉东缘（平均海拔4000m跃降）',
    color: '#c792ff',
    coords: [[75.5, 38.4], [80.0, 36.2], [86.0, 36.4], [90.8, 38.2], [95.0, 39.3], [99.5, 38.1], [102.5, 36.2], [103.3, 32.5], [102.6, 29.5], [101.2, 26.5], [99.8, 24.2]]
  },
  {
    id: 'step_2_3',
    name: '地势第二、三级阶梯分界线',
    desc: '大兴安岭—太行山脉—巫山—雪峰山（高原盆地向东部平原丘陵过渡）',
    color: '#ff9fe5',
    coords: [[122.4, 52.2], [120.5, 48.0], [118.2, 44.0], [115.2, 40.1], [113.8, 37.2], [113.0, 35.0], [111.2, 32.8], [109.9, 30.8], [110.8, 28.4], [110.2, 26.0], [108.8, 23.8]]
  }
];
