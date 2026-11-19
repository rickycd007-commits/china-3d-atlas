import { projectLonLat, elevMetersToWorldY } from '../utils/projection.js';

// 1. 中国十四大核心地形区（四大高原、四大盆地、三大平原、三大丘陵 + 河西走廊）
export const LANDFORM_REGIONS = [
  // 四大高原
  { id: 'qingzang', name: '青藏高原', cat: '四大高原', lonLat: [88.5, 33.2], elev: 4500, tag: '第一级阶梯', desc: '世界海拔最高、面积最大的高原（平均>4000m），“远看是山，近看是川”，现代冰川与冻土广布，中华水塔。' },
  { id: 'neimenggu', name: '内蒙古高原', cat: '四大高原', lonLat: [111.5, 43.8], elev: 1100, tag: '第二级阶梯', desc: '地面坦荡开阔、起伏和缓，自东向西由呼伦贝尔温带草原过渡为荒漠草原与戈壁。' },
  { id: 'huangtu', name: '黄土高原', cat: '四大高原', lonLat: [109.2, 36.8], elev: 1350, tag: '第二级阶梯', desc: '太行山以西、秦岭以北、乌鞘岭以东，风力沉积深厚黄土，流水侵蚀呈千沟万壑、塬梁峁地貌。' },
  { id: 'yungui', name: '云贵高原', cat: '四大高原', lonLat: [104.8, 25.8], elev: 1650, tag: '第二级阶梯', desc: '地表崎岖不平，“地无三尺平”，石灰岩广布，喀斯特峰林、溶洞、暗河与山间“坝子”发育典型。' },

  // 四大盆地
  { id: 'tarim_b', name: '塔里木盆地', cat: '四大盆地', lonLat: [83.2, 39.2], elev: 1000, tag: '最大内陆盆地', desc: '介于天山与昆仑山之间，我国面积最大内陆盆地，中部为塔克拉玛干流动性沙漠，边缘环绕冰雪融水绿洲。' },
  { id: 'junggar_b', name: '准噶尔盆地', cat: '四大盆地', lonLat: [86.2, 45.4], elev: 550, tag: '西风湿润缺口', desc: '介于阿尔泰山与天山之间，西北有山地缺口迎受大西洋/北冰洋西风水汽，降水略多于塔里木，冬季积雪稳定。' },
  { id: 'qaidam_b', name: '柴达木盆地', cat: '四大盆地', lonLat: [94.6, 37.3], elev: 2850, tag: '聚宝盆', desc: '嵌于青藏高原东北部（昆仑—阿尔金—祁连环抱），我国海拔最高的内陆大盆地，盐湖、钾镁锂矿藏富甲天下。' },
  { id: 'sichuan_b', name: '四川盆地', cat: '四大盆地', lonLat: [105.4, 30.4], elev: 480, tag: '天府紫色盆地', desc: '四周被秦岭、大巴山、巫山、大娄山与川西高原环绕，北山阻挡寒潮故冬暖无严寒，成都平原沃野千里。' },

  // 三大平原
  { id: 'dongbei_p', name: '东北平原', cat: '三大平原', lonLat: [124.5, 45.2], elev: 160, tag: '最大平原·黑土', desc: '我国面积最大平原（约35万km²），由松嫩平原、辽河平原、三江平原组成，黑土深厚肥沃，商品粮基地。' },
  { id: 'huabei_p', name: '华北平原', cat: '三大平原', lonLat: [116.2, 36.8], elev: 50, tag: '黄淮海平原', desc: '燕山以南、淮河以北、太行山以东，由黄河、淮河、海河泥沙合力冲积塑造，地势坦荡低平。' },
  { id: 'changjiang_p', name: '长江中下游平原', cat: '三大平原', lonLat: [116.8, 30.6], elev: 30, tag: '鱼米之乡', desc: '自巫山巫峡以东沿江呈串珠状展布（江汉、洞庭湖、鄱阳湖、苏皖沿江与长三角），河湖密布，水乡泽国。' },

  // 丘陵与走廊
  { id: 'dongnan_h', name: '东南丘陵', cat: '主要丘陵', lonLat: [115.2, 26.8], elev: 420, tag: '江南/浙闽/两广', desc: '长江以南、雪峰山以东广大低山丘陵统称，红壤广布，盛产茶树、毛竹与亚热带经济林木。' },
  { id: 'shandong_h', name: '山东丘陵', cat: '主要丘陵', lonLat: [118.8, 36.5], elev: 320, tag: '暖温带半岛丘陵', desc: '黄河以南、京杭运河以东，泰山突起中部，半岛深入渤黄二海，暖温带果业与海洋渔业发达。' },
  { id: 'hexi_c', name: '河西走廊', cat: '地理咽喉', lonLat: [100.2, 39.2], elev: 1450, tag: '丝路绿洲通道', desc: '祁连山与合黎山、龙首山之间的狭长堆积平原，仰仗祁连山高山冰雪融水灌溉，沟通中原与西域。' },
];

// 2. 高频考点：重要界山两侧地形区/省区空间对比表
export const MOUNTAIN_FLANKS = {
  taihang: { west: '黄土高原（山西省）', east: '华北平原（河北省）', examTip: '二、三级阶梯界山；迎风东坡多地形暴雨' },
  daxingan: { west: '内蒙古高原（温带草原/半干旱）', east: '东北平原（湿润半湿润耕作业）', examTip: '400mm线、季风与非季风区、内外流区多重分界' },
  wushan: { west: '四川盆地（重庆）', east: '长江中下游平原·江汉平原（湖北）', examTip: '长江深切巫山形成三峡，水能极其丰富' },
  xuefeng: { west: '云贵高原', east: '江南丘陵（东南丘陵西段）', examTip: '第二、三级阶梯南段重要界山' },
  qinling: { north: '关中渭河平原 / 黄土高原（暖温带·旱地）', south: '汉水谷地 / 四川盆地（亚热带·水田）', examTip: '1月0℃等温线、800mm等降水量线、常绿与落叶阔叶林分界' },
  tianshan: { north: '准噶尔盆地（北疆·中温带）', south: '塔里木盆地（南疆·暖温带）', examTip: '天山北坡受西风与北冰洋水汽抬升，发育山地云杉针叶林带与腰部冬牧场' },
  kunlun: { north: '塔里木盆地 / 柴达木盆地', south: '青藏高原（藏北羌塘高原）', examTip: '地势第一、二级阶梯北段分界线' },
  qilian: { north: '河西走廊 / 内蒙古高原', south: '柴达木盆地 / 青海湖盆地', examTip: '一、二级阶梯与200mm等降水量线关键界山，北坡冰川育绿洲' },
  wuyi: { west: '江南丘陵·赣江流域（江西省）', east: '浙闽丘陵·闽江流域（福建省）', examTip: '东南季风迎风坡（东坡）降水显著多于西坡' },
  nanling: { north: '江南丘陵（长江水系·湘赣）', south: '两广丘陵与珠三角（珠江水系·粤桂）', examTip: '阻挡冬季残余寒潮南下，华南极少霜雪' },
  helan: { west: '腾格里沙漠 / 阿拉善高原（非季风干旱区）', east: '宁夏银川平原（塞上江南·半干旱引黄灌溉）', examTip: '200mm等降水量线与季风区西界标志山脉' },
  yinshan: { north: '内蒙古高原草原荒漠带', south: '黄河河套平原（重要灌溉农业区）', examTip: '季风区与非季风区、内外流区北界' },
  hengduan: { west: '青藏高原主体', east: '四川盆地 / 云贵高原', examTip: '南北纵列山系，“一山有四季，十里不同天”垂直地带性最显著' },
  himalaya: { north: '青藏高原雅鲁藏布江谷地（雨影少雨）', south: '恒河—布拉马普特拉平原（迎风坡乞拉朋齐世界雨极）', examTip: '亚欧板块与印度洋板块挤压隆升前缘' },
};

// 3. 胡焕庸线（黑河—腾冲线）与内外流区分界线
export const SPECIAL_GEO_LINES = {
  huLine: {
    id: 'hu_line',
    name: '胡焕庸线（黑河—腾冲人口地理分界线）',
    color: '#ff4d6d',
    coords: [[127.53, 50.24], [123.0, 46.2], [118.2, 42.0], [113.5, 37.8], [108.8, 33.8], [104.0, 29.8], [98.50, 25.02]],
    eastStat: '东南半壁：面积 43.8% · 人口 ~93.5%',
    westStat: '西北半壁：面积 56.2% · 人口 ~6.5%',
    desc: '1935年地理学家胡焕庸先生提出。该线与400mm年等降水量线、地势二三级阶梯线高度吻合，深刻揭示了中国水热地形条件对人口承载力、城镇化与农业格局的决定性塑造。',
  },
  endorheicLine: {
    id: 'endorheic_line',
    name: '外流区与内流区分界线',
    color: '#38bdf8',
    coords: [[121.0, 50.8], [118.5, 45.8], [114.2, 41.8], [109.5, 41.1], [106.0, 38.8], [102.8, 37.4], [98.8, 34.6], [93.5, 32.2], [87.5, 30.2], [81.5, 30.8]],
    desc: '大致沿大兴安岭西麓—阴山—贺兰山—祁连山东端—巴颜喀拉山—冈底斯山一线：东南侧约占全国面积2/3、水量超95%为外流区（注入太平洋、印度洋、北冰洋）；西北侧约占1/3为内流区。',
  },
};

// 4. 三大洋流域水系归属 & 阶梯交界超级水利工程
export const RIVER_OCEAN_BASIN = {
  yangtze: { basin: '太平洋水系', basinColor: '#2dd4bf' },
  yellow: { basin: '太平洋水系', basinColor: '#2dd4bf' },
  pearl: { basin: '太平洋水系', basinColor: '#2dd4bf' },
  heilongjiang: { basin: '太平洋水系', basinColor: '#2dd4bf' },
  songhua: { basin: '太平洋水系', basinColor: '#2dd4bf' },
  lancang: { basin: '太平洋水系（南海）', basinColor: '#2dd4bf' },
  huaihe: { basin: '太平洋水系', basinColor: '#2dd4bf' },
  haihe: { basin: '太平洋水系', basinColor: '#2dd4bf' },
  liaohe: { basin: '太平洋水系', basinColor: '#2dd4bf' },
  grand_canal: { basin: '人工沟通太平洋五大水系', basinColor: '#67e8f9' },
  yarlung: { basin: '印度洋水系（孟加拉湾）', basinColor: '#818cf8' },
  nujiang: { basin: '印度洋水系（安达曼海）', basinColor: '#818cf8' },
  irtysh: { basin: '北冰洋水系（唯一）', basinColor: '#e0f2fe' },
  tarim: { basin: '西北内流河水系', basinColor: '#fbbf24' },
};

export const MEGA_HYDRO_PROJECTS = [
  { id: 'sanxia', name: '三峡水利枢纽', lonLat: [111.00, 30.82], river: '长江', step: '二、三级阶梯交界（巫山）', desc: '世界装机容量最大水电站（2250万kW），兼具防洪（荆江河段）、发电、川江航运与水资源调配综合效益。' },
  { id: 'baihetan', name: '白鹤滩水电站', lonLat: [102.90, 27.22], river: '金沙江', step: '一、二级阶梯过渡带', desc: '单机百万千瓦世界第二大水电站，“西电东送”骨干清洁能源基地，利用横断峡谷巨大落差。' },
  { id: 'xiaolangdi', name: '小浪底水利枢纽', lonLat: [112.36, 34.92], river: '黄河', step: '二、三级阶梯出口', desc: '控制黄河92%流域面积与近100%输沙量，每年“调水调沙”冲刷下游地上悬河河槽。' },
  { id: 'longyangxia', name: '龙羊峡水电站', lonLat: [100.92, 36.12], river: '黄河上游', step: '一、二级阶梯交界峡谷', desc: '“万里黄河第一坝”，库容巨大，调节黄河上游梯级电站水量。' },
  { id: 'dujiangyan', name: '都江堰水利工程', lonLat: [103.61, 31.00], river: '岷江', step: '川西高原入成都平原出山口', desc: '公元前256年李冰父子修筑，鱼嘴分水、飞沙堰溢洪、宝瓶口引水，无坝引水造就两千余年天府粮仓。' },
];

// 5. 中国锋面雨带与西太平洋副热带高压脊线 1—12 月逐月规律（高考核心专题！）
export const MONTHLY_CLIMATE_GUIDE = [
  { month: 1, seasonVal: 3.00, subHighLat: 13, rainBeltLat: [18, 22], title: '1月 · 隆冬寒潮与南北温差极值', phenomenon: '蒙古—西伯利亚高压鼎盛', detail: '1月0℃等温线压在秦岭—淮河一线，漠河与海口温差逾50℃；云贵高原乌蒙山阻挡冷空气形成「昆明准静止锋」（贵阳阴雨冷湿、昆明暖晴）。', typhoon: false },
  { month: 2, seasonVal: 3.33, subHighLat: 14, rainBeltLat: [19, 23], title: '2月 · 残冬向早春过渡', phenomenon: '冬季风渐弱 · 华南回南天初现', detail: '北方仍处冰封期，南海暖湿气流开始间歇北抬，华南沿海偶现平流雾与回南天。', typhoon: false },
  { month: 3, seasonVal: 3.67, subHighLat: 15, rainBeltLat: [21, 25], title: '3月 · 江南春雷惊蛰与北方沙尘', phenomenon: '冷暖气团在南岭—江南拉锯', detail: '江南进入春雨绵绵期；西北与华北地表解冻、降水尚少且多大风，易发春季沙尘天气。', typhoon: false },
  { month: 4, seasonVal: 0.00, subHighLat: 16, rainBeltLat: [21.5, 25.5], title: '4月 · 华南前汛期开始 & 华北春旱', phenomenon: '锋面雨带登陆华南沿海', detail: '【高频考点·华北春旱成因】春季太阳直射点北移，华北气温回升快、大风蒸发旺，此时锋面雨带仍在华南未达北方，加之冬小麦返青需水量大，“春雨贵如油”。', typhoon: false },
  { month: 5, seasonVal: 0.33, subHighLat: 18, rainBeltLat: [22, 26.5], title: '5月 · 华南盛雨期（龙舟水）', phenomenon: '副高脊线位于 15°N—18°N', detail: '暖湿东南季风与南下冷空气交汇于南岭至珠江流域，两广、福建进入强降水“龙舟水”集中期。', typhoon: false },
  { month: 6, seasonVal: 0.67, subHighLat: 22.5, rainBeltLat: [28, 33], title: '6月 · 江淮梅雨（准静止锋）', phenomenon: '副高第一次北跳至 20°N—25°N', detail: '【高频考点·梅雨】雨带北跃停滞在长江中下游至淮河流域，冷暖气团势均力敌形成「江淮准静止锋」，阴雨连绵长达一月（“黄梅时节家家雨”）。', typhoon: false },
  { month: 7, seasonVal: 1.00, subHighLat: 27.5, rainBeltLat: [35, 43], title: '7月 · 华北东北雨季 & 江淮伏旱', phenomenon: '副高第二次北跳至 25°N—30°N', detail: '【高频考点·伏旱】锋面雨带推至华北、东北（“七下八上”防汛关键期）；而长江中下游反被西太平洋副热带高压脊主体控制，盛行下沉气流，酷热少雨出现「伏旱」，唯有台风登陆可解旱情！', typhoon: true },
  { month: 8, seasonVal: 1.33, subHighLat: 28.5, rainBeltLat: [36, 46], title: '8月 · 北方盛夏暴雨 & 东南台风活跃', phenomenon: '雨带达最北界 · 台风高频登陆', detail: '东南季风抵达大兴安岭—阴山—贺兰山季风北界；西北高山冰雪融水达峰值（塔里木河夏汛）；东南沿海台风携狂风暴雨西行北上。', typhoon: true },
  { month: 9, seasonVal: 1.67, subHighLat: 23.0, rainBeltLat: [27, 34], title: '9月 · 雨带迅速南撤 & 华西秋雨', phenomenon: '副高南退 · 华西秋雨绵绵', detail: '【高频考点·华西秋雨】北方冷空气增强推动雨带快速南撤，冷暖空气在四川盆地、贵州、陕南秦巴山地交汇滞留，形成秋雨多、日照少的「华西秋雨」（“巴山夜雨涨秋池”）。', typhoon: true },
  { month: 10, seasonVal: 2.00, subHighLat: 19.0, rainBeltLat: [20, 25], title: '10月 · 秋高气爽与层林尽染', phenomenon: '大陆冷高压建立 · 雨带退回华南南海', detail: '我国大部受高压控制，晴朗少云、昼夜温差大，大兴安岭、长白山、秦岭红叶与金桦自北向南依次染色。', typhoon: false },
  { month: 11, seasonVal: 2.33, subHighLat: 16.0, rainBeltLat: [18, 22], title: '11月 · 深秋寒潮爆发南下', phenomenon: '强冷空气频袭 · 秦岭阻寒效应显现', detail: '西伯利亚寒潮大举南侵，北方入冬初雪；秦岭、大巴山有力阻挡冷空气深入四川盆地。', typhoon: false },
  { month: 12, seasonVal: 2.67, subHighLat: 14.0, rainBeltLat: [18, 21], title: '12月 · 北国冰封与冬季风盛行', phenomenon: '西北冬季风全面控场', detail: '黄河宁夏—内蒙河套段因低纬流向高纬开始封冻出现冬季「凌汛」隐患；东北雪原林海银装素裹。', typhoon: false },
];

export function projectTeachingEntities(sampleElevAtXZ) {
  const landforms = LANDFORM_REGIONS.map((lf) => {
    const [x, z] = projectLonLat(lf.lonLat[0], lf.lonLat[1]);
    const e = Math.max(20, sampleElevAtXZ(x, z));
    return {
      ...lf,
      xyz: [x, elevMetersToWorldY(e) + 0.35, z],
    };
  });

  const hydroProjects = MEGA_HYDRO_PROJECTS.map((hp) => {
    const [x, z] = projectLonLat(hp.lonLat[0], hp.lonLat[1]);
    const e = Math.max(15, sampleElevAtXZ(x, z));
    return {
      ...hp,
      xyz: [x, elevMetersToWorldY(e) + 0.25, z],
    };
  });

  function buildLine3D(coords) {
    // Subdivide smoothly
    const pts = [];
    for (let i = 0; i < coords.length - 1; i++) {
      const [lon0, lat0] = coords[i];
      const [lon1, lat1] = coords[i + 1];
      const steps = 12;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const lon = lon0 + (lon1 - lon0) * t;
        const lat = lat0 + (lat1 - lat0) * t;
        const [x, z] = projectLonLat(lon, lat);
        const e = Math.max(5, sampleElevAtXZ(x, z));
        pts.push([x, elevMetersToWorldY(e) + 0.14, z]);
      }
    }
    const last = coords[coords.length - 1];
    const [lx, lz] = projectLonLat(last[0], last[1]);
    pts.push([lx, elevMetersToWorldY(Math.max(5, sampleElevAtXZ(lx, lz))) + 0.14, lz]);
    return pts;
  }

  return {
    landforms,
    hydroProjects,
    huLine: {
      ...SPECIAL_GEO_LINES.huLine,
      points: buildLine3D(SPECIAL_GEO_LINES.huLine.coords),
    },
    endorheicLine: {
      ...SPECIAL_GEO_LINES.endorheicLine,
      points: buildLine3D(SPECIAL_GEO_LINES.endorheicLine.coords),
    },
  };
}
