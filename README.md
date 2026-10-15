# 学术项目网页

## DreamCan Method 章节

`index.html` 中的 `#method` 包含简介和四个选项卡：Reachability Value Function、Task Utility Value Function、Dynamic Programming for Subgoal Discovery、Finetune Video Generation Model。`method.js` 管理选项卡，支持左右方向键及 Home/End，切换时暂停隐藏面板的视频。

第一个选项卡依据 `/home/gck/Desktop/DreamCan_ICRA.pdf` 的 §IV-A 编写，采用左侧文字与原生 MathML 公式、右侧网络结构框图的布局。左侧叙述归一化 reachability、TD 目标和 expectile 损失；右侧 `assets/method/reachability-network.svg` 展示共享的 frozen RADIO、时序 Transformer、第二帧 MLP、语言编码、成对特征融合及价值输出。全文使用两帧状态 `s_i` / `s_j`，不将第二帧称为任务 goal。`reachability.js` / `reachability.css` 实现真实数据交互：四类数据集共 58 条轨迹（LIBERO-Long 10 条、Language Table 42 条、PushT / Square 各三条）、左侧 24 张均匀抽帧缩略图完整展开、帧 i/j 点击选择、支持任意帧的滑杆、右侧单条 reachability 曲线及数值悬停。桌面端使用等高双栏，宽屏缩略图每行八张、滑杆并排，右侧曲线根据容器尺寸自适应；窄屏改为上下布局。鼠标在图表上移动时，横纵虚线交汇在对应帧的实际预测值上，并显示数值提示；移出图表或悬停在未缓存的反向帧对上时自动隐藏。任务指令前标注 Language Instruction:。选择帧 i 更新整条曲线，选择帧 j 更新曲线上的标记。帧 i 始终早于帧 j；选择越过另一个端点时，另一端点自动移到相邻有效帧。展示区不加载或播放视频，也不单独显示所选两帧的预览图。

`assets/reachability/manifest.json` 记录所选轨迹与来源。每条轨迹包含 `video.mp4`、所有帧的 `frames.webp` 图集、`curves.json` 和未经修改的 `source-values.npz`。LIBERO-Long 的 10 个不同任务各取一条（ep_000000/1/2/6/7/8/10/12/14/27）；Language Table 按源 metadata 的原始指令去重，Make a line 11 条、All to region 9 条、Canonical shape 22 条，每种指令各取首个同时具有视频与已训练缓存的轨迹。Canonical shape 沿用源数据分类，包含 rainbow 和 smiley face；展示完整原始指令，菜单使用简短名称并按三类分组。manifest 的 coverage 记录类别、指令数及 metadata / 缓存路径。PushT 仍选择 ep_000000/1/2，Square 仍选择 better ep_000000、okay ep_000100、worse ep_000050。共 1,218,483 个已训练模型的前向成对预测，按 `clip(1 + (1 - gamma) * V_R, 0, 1)` 转换，gamma = 0.95；只做五位小数保存，不平滑、不按时间合成曲线。`forwardReachability[i][j-i-1]` 对应 `R(s_i, s_j)`（j > i）。曲线中的实线表示 `R(s_i, s_t)`，实心标记表示所选帧 j 的 `R(s_i, s_j)`，空心端点表示理论边界 `R(s,s)=1`，并非缓存预测。

视频与矩阵逐帧对齐。Language Table 保留源视频帧率，其余任务从训练 HDF5 的 `image` 帧导出为 10 fps 展示视频；这个帧率用于播放，不表示物理时间。图中横轴统一使用源轨迹帧号。manifest 保存原始缓存的 SHA-256 和源路径；Language Table 的缓存还包含 checkpoint 路径，其余缓存未记录精确 checkpoint，未额外推断。

可通过 `scripts/export_reachability_assets.py` 在 lyg2080 上重新导出。脚本只读取源数据，输出应指定到临时目录。默认导出全部四类；可通过 `--datasets libero-long language-table` 仅导出这两类，此时须将部分 manifest 合并到现有四类 manifest。导出前检查指令覆盖，遇到缺失视频或缓存则报错。需要远程 planning 环境的 numpy、h5py、Pillow、OpenCV 以及 ffmpeg：

```bash
scp scripts/export_reachability_assets.py lyg2080:/tmp/export_dreamcan_reachability.py
ssh lyg2080 '/data/gck/miniconda3/envs/planning/bin/python /tmp/export_dreamcan_reachability.py --output /tmp/dreamcan-reachability-web'
ssh lyg2080 'tar -czf - -C /tmp/dreamcan-reachability-web .' > /tmp/dreamcan-reachability-assets.tar.gz
mkdir -p assets/reachability
tar -xzf /tmp/dreamcan-reachability-assets.tar.gz -C assets/reachability
```

通过下方 HTTP 本地预览方式打开页面；直接用 `file://` 打开 HTML 时，浏览器会限制 JSON 数据加载。当前已核验所有新增资源下载前后的 SHA-256、52 条导出视频的逐帧长度、三个 Language Table 类别的完整原始指令集合，以及曲线转换的最大舍入误差 ≤ 5e-6；在 Chromium 中核验全部 58 条轨迹、任务/轨迹切换、缩略图及滑杆选帧、实际曲线数值、数值悬停、Method 面板切换和手机端布局，并确认展示区只绘制一条曲线且没有视频请求。

第二个选项卡依据论文 §IV-B，沿用 MathML 字号，桌面采用两行分别配对的布局：RoboMeter 说明与网络图、VLM+SAM 说明与检测视频各占同一网格行，逐行等高且上下边缘对齐。简介横跨两栏。窄屏按文字 → 对应媒体的顺序排列。左侧说明 RoboMeter 的视频片段 / 指令配对、相对时间位置产生的逐帧进度目标，以及反向、回退和不匹配指令的训练样本；冻结视觉编码器和基础权重，训练 LoRA 与 progress / success heads，以十个离散区间的软目标计算进度 CE，并辅以成功判别 BCE。微调细节核对了服务器 PushT / Square checkpoint 的 `config.yaml` 和 `/data/gck/robometer/robometer/` 下的 progress sampler、标签构建 helper 与 `rbm_heads_trainer.py`；这里描述项目实际使用的 progress / success 微调。VLM+SAM 则精简为指令转空间规则、物体检测和 make-a-line 的软对齐 / 间距评分，两块均精简以匹配各自右侧媒体的高度。右侧 `assets/method/robometer-network.svg` 简绘视频 / 语言 token → 因果 VLM → progress MLP 的路径，结构参考 [RoboMeter 原论文](https://arxiv.org/html/2603.02115v1)；下方播放服务器已有的 SAM2 检测可视化 `07_w248_e12_sam2_overlay.mp4`。选择该视频是因为对角线及最终八个物块清晰、遮挡少。素材完整保留原视频与数值读数：266 个源帧、10 fps、最后额外停留 10 帧，共 27.6 秒；视频上的数值是五帧平滑后的原始空间进度，后续归一化后的标注 U 在下方曲线展示。`line-detection-source.json` 记录原视频、检测 JSON、渲染脚本及原文件 SHA-256。视频仅在该选项卡首次打开时加载，静音循环播放，隐藏时暂停、返回后续播。

`utility.js` / `utility.css` 复用现有缩略图、控件和等高曲线区的样式，覆盖同样的 58 条轨迹、10,809 个单帧 utility 标注。Utility 是单帧进度，因此使用帧 t 选择；点击缩略图、滑杆或图表更新标记，完整曲线保持不变。保留横纵悬停虚线、逐轨迹选帧记忆及 Language Table 三类指令分组。每条 `assets/utility/<trajectory>/utility.json` 保存完整原始 progress、标注 U 和来源；图集直接使用 reachability 已有资源。Language Table 的 U 逐值保留 NPZ 中的 `progress_search`，不再平滑或重新拟合；RoboMeter 来自源 progress JSON，采用项目 DP 标注器原有的 `normalize_progress(progress, 'mono')`（七帧平滑、归一化与运行最大值）。原 progress JSON 可能已将实际稀疏模型预测插值到源帧号，页面保留这些现有对齐结果。LIBERO-Long 使用记录的 pretrained RoboMeter 输出，PushT / Square 使用已有进度推断，方法文字说明按需 LoRA 适配；不推断源记录缺失的 checkpoint。

可通过 `scripts/export_utility_assets.py --manifest <当前 reachability manifest> --output <临时目录>` 在远程 planning 环境重导出 utility；脚本只读取原始数据，遇到缺失、帧数不符、非有限或恒定预测时报错，不生成时间进度替代值。已核验导出文件 SHA-256、58 条轨迹的指令 / 帧数 / 图集对应关系，以及曲线单调性和范围；Chromium 检查涵盖全部 utility 标注、选帧与曲线交点、循环播放与隐藏恢复、加载失败重试、快速切换、键盘滑杆、320–1440 px 布局及 Method 选项卡间的独立状态。

第三个选项卡依据 `/home/gck/Desktop/video_dreamcan.pptx` 第14–16页重新排版（请求中的 `/home/Desktop/video_dreamcan.ppt` 在本机不存在）。左侧依次解释可达性、任务进度及 spacing 的作用、序列级最大化目标、DP 递推及回溯。PPT 中的 Ω 用服务器标注器的具体间隔定义补全，统一为帧索引 i/j 和剩余子目标数 m。Input / Output 保留已确认的文案。

右侧示例现为 LIBERO-Long task 03 `ep_000002`（把黄白杯放入微波炉并关门）。正确K直接读取实际训练标注 `outputs/value_progress_keyframe_dp/reward_space_gap06_annotations.json` 中的 `dp_k_subgoals=6`，对应36/70/125/175/255/293，额外附加末帧为344。完整演示345帧。服务器以原始 `docs/paper/fig_frame0_selection_curves.py` 的同一计算逻辑，在这条轨迹上绘制全部6轮，逐轮argmax与原始训练标注完全一致；没有使用静态展示脚本默认K=5，也不把附加末帧计入DP子目标数量。

服务器产物位于 `/data/gck/svl_project/outputs/website_dp_task03_ep000002_k6/`，已全部下载到本地 `outputs/dp_ep000002_k6/`，包含6张PNG/PDF、汇总图、改编绘图脚本、原始/归一化曲线数据与全帧图集。网页资源在 `assets/dp/example-ep000002/`。图集源为 `/mnt/gck/libero_data/libero_hdf5/LIBERO_Long.h5::episodes/ep_000002/image`，345帧逐帧保留，192px缩略图仅改变展示尺寸，元数据记录来源与SHA-256。

`dp-example.js` 首次打开DP面板时加载此示例。顶部居中显示完整任务指令，沿用原标题字体/字号。左右预览分别显示当前轮初始帧和候选帧；右图默认显示本轮最优subgoal，悬停曲线时更新为对应候选帧，离开时恢复默认。7个并列数字按钮，默认第1轮；前6个切换真实DP曲线，第7个显示最后DP帧293与附加末帧344，并绘制相同 `selection_curve` 在 i=293、m=1 时的真实候选得分；图内说明末帧为固定附加目标。按钮数、剩余数量、键盘边界和横轴末帧均由当前数据确定。原ep_000062的K=8素材保留但不再用于右侧展示。

SVG逐点绘制normalizedScores，显示完整0–1得分范围，星号标记最优帧。鼠标吸附最近的实际候选帧，横纵虚线及点标记随动，右侧图同步更新；同一轮内初始帧保持不变。按钮和曲线均支持方向键/Home/End，失败可重试。右侧不依赖下方独立探索区的任务或K选择。 Chromium已核验6轮切换、每轮初始/默认目标/悬停候选帧、曲线坐标、离开恢复、键盘操作及320–1440px布局；下载图集SHA-256与来源元数据一致。


下方 `dp.js` / `dp.css` 展示四类任务全部58条轨迹，按时间顺序横向铺开每一帧。唯一参数控件为 K（LIBERO-Long / PushT 1–10，Language Table 1–16，Square 1–8）；拖动后在 Web Worker 中重算，并只显示选中的 K 个 subgoal，不附加起始帧或末帧。权重固定为原默认值，最小帧间隔根据 K 自动限制为可行值。完整序列中以描边标出已选帧。数据由 `assets/dp/manifest.json` 引用现有真实 reachability / utility 数组和 WebP 图集；优化枚举全部候选帧。运行 `python3 scripts/build_dp_manifest.py` 可重建索引。

`dp-solver.js` 保留已通过穷举验证的后向最小代价求解器；其目标正好是页面最大化目标的负值。计算使用 reachability 数值下界0.02，时间复杂度 O(KL²)，并优先选择最早的等价最优帧。首次打开选项卡时加载数据；快速切换轨迹或 K 时只展示最新结果，每次请求明确初始化对应视频的数据，失败可重试。

本次 Chromium 检查覆盖58条轨迹的完整帧数、默认4张结果、K=1/4/5/12重算、仅一个参数控件、320–1440px无页面横向溢出。算法此前已通过小规模穷举和58条真实数据的路径代价/约束验证。

第四个选项卡现展示离散subgoal序列如何用于Wan2.2-TI2V-5B微调。依据本地 `DreamCan_ICRA.pdf` §IV-D / Eq.(6)、`video_dreamcan.pptx` 第16页，以及服务器 `planning/dataset/wan_libero_subgoal_dataset.py`、`planning/dataset/libero_video_gen_action_keyframe_dataset.py`、`scripts/train_wan_libero_subgoal_lora.py`、`scripts/train_wan_language_table_line_subgoal_multianchor_lora.py` 与 DiffSynth `diffsynth/diffusion/loss.py`、`diffsynth/diffusion/flow_match.py` 核对。

`assets/method/wan-finetune/wan-finetune.svg` 为原生横向SVG架构图：当前观测及稀疏监督目标 → 每目标连续重复4帧 → 冻结因果3D VAE → 对齐的N+1个latent slots → 干净条件/带噪未来目标与文本 → Wan DiT的LoRA适配 → 仅未来slots的flow-matching MSE。噪声混合为(1−σ)z+σε，监督目标为ε−z，loss含scheduler权重。VAE、文本encoder和DiT基础权重冻结，仅LoRA训练；图中回传线指向LoRA。

图中观测及g₁/g₂/gₙ照片取自task03 `ep_000002` 的原始HDF5帧0/36/70/344，作为含省略号的结构示例，不表示完整训练窗口只有3个目标。`source.json` 记录来源；运行 `python3 scripts/build_wan_finetune_diagram.py` 可从这四张原始JPG重建内嵌图像的独立SVG。网页使用斯坦福红/Abstract蓝配色及Method字体，给出4次复制与latent对齐公式、dense observation条件采样说明、随机clean-prefix的变体和masked flow loss；普通训练对应P=0，搜索适配可保留P>0的前缀。随机前缀实现是Language Table专用脚本中的已核验扩展，不将其误称为所有LIBERO checkpoint的默认训练方式。 图中Instruction ℓ作为独立输入框连到text encoder；对齐latent区域明确分为蓝色clean prefix（观测与g₁…gₚ，σ=0、不计算loss）和斯坦福红future suffix（gₚ₊₁…gₙ，加噪并计算loss），两条分支分别进入DiT。下方另画0/1 loss-mask token带，直观展示随机前缀划分。Prefix-conditioned training段落已移到图上方，删除原图底部caption。

`wan-finetune.css` 在桌面完整铺开横向图，手机端图内横向滚动，保持文本可读。Chromium核验图像解码、公式、320–1440px无页面溢出、手机端图内滚动及DP选项卡仍正常；所有其他Method选项卡保持独立。

Method目前使用的三张框图（Reachability / RoboMeter / WAN微调）已统一为论文插图风格：白底、直角矩形、细线箭头、Arial/Helvetica模块标签和Times数学符号。以Abstract蓝/斯坦福红区分prefix与受监督目标/LoRA，冻结模块用虚线边框；WAN的LoRA更新路径改为虚线，与前向数据流区分。WAN阶段标题改为(a)–(d)子图标签，RoboMeter输出连接对齐MLP中心。`method-figures.css` 仅移除这三张框图外层的圆角卡片装饰，其余Method的曲线、视频与交互控件样式保持独立。WAN渲染脚本已同步新风格，重建不恢复旧配色；SVG仍可独立导出。Chromium核验三张图片、边框样式、320–1440px布局及DP交互。

从页首至Method结束的配色由 `front-palette.css` 局部统一：斯坦福红 `#8C1515`、Abstract蓝 `#1565C0`，另用深色 `#202020` 和白色 `#FFFFFF`；边框及浅底由这四种基础色混合。文字、按钮、选项卡、交互曲线与三张SVG框图同步，原始照片及视频保留。样式仅作用于对应章节及其激活导航状态，不覆盖全局变量。Chromium核验四个Method选项卡、曲线颜色、320–1440px布局，以及Experimental Results之后的样式与内容完全未变。

Method文字采用分层阅读：蓝色小标题、短要点和核心公式组成默认视图；原生 `details/summary` 收纳Reachability训练目标与采样、RoboMeter预测与loss细节、SAM空间评分、DP spacing、WAN flow-matching loss。DP删去与递推式重复的argmax展示，用回溯说明替代；其余公式保留。WAN上方以三个并列步骤说明目标对齐、干净前缀及LoRA训练。`method-readability.css` 仅作用于Method，不改数据、算法、框图或explorer。已核验四个选项卡、键盘展开/收起、320–1440px展开与默认布局及原有曲线交互。

## DreamCan Experiments 章节

`#experiments` 紧接 Method，沿用相同布局，包含六个选项：Long-Horizon Task Planning、Learning from Sub-optimal Data、Test-Time Search & Language Steering、Goal-Conditioned Low-Level Policy、Real-World Tasks、Ablation Studies。所有面板均已接入真实素材、论文表格或可核验的原始评估图。`method.js` 管理两个章节的顶层切换，`planning.js` / `experiments.js` 管理各面板内部选择；嵌套选项卡互不干扰。

Long-Horizon Task Planning 使用 `planning.js` / `planning.css` 展示三项 Language-Table 任务，每项三组代表样例。任务按钮支持方向键及 Home/End，Example 1/2/3 同时切换同一指令和初始场景下的所有可用方法视频，并保留各任务已选样例。桌面端左上为成功率表格、左下为 Ours 的 sparse DP 生成视频，右侧纵向排列 Dense、Uniform、VLP；手机端按左侧内容、三项 baseline 的顺序排列。视频静音、自动循环播放，离开实验面板、离开视口或浏览器标签页隐藏时暂停。

成功率依据 `/home/gck/Desktop/DreamCan_ICRA.pdf` 的 Tables II–III：Make a line 的 Dense / Uniform / VLP / Ours 分别为 71% / 69% / 56% / 86%；All to region 的 VLP / Ours 为 78% / 100%；Canonical shape 的 VLP / Ours 为 15% / 52%。论文未报告后两项任务的 Dense / Uniform 成功率；现按用户提供的数据补充为 All to region 72% / 80%、Canonical shape 23% / 17%，并在 manifest 中单独记录来源。Make a line 的数值还与远程 `outputs/line_plan_success/report_sam2.json` 的 100 个视频评估核对一致。各表格呈现整体评估成功率，不将三个展示样例重新计算为成功率。

`assets/experiments/planning/manifest.json` 保存 9 组样例、36 个模型生成视频（其中九个为临时 Dense 替代）的来源、SHA-256、原始帧数、帧率、尺寸和语言指令。Make a line 选 `w100_e43`（vertical right）、`w131_e11`（horizontal bottom）、`w205_e30`（diagonal）；All to region 选 `w14_e0` / `w39_e34` / `w188_e43`（三个目标角落）；Canonical shape 选 `w321_e18` / `w158_e15` / `w306_e5`（N / square / diamond）。视频来自已有评估结果，保留全部原始帧和原始播放速度；Ours 展示生成的 sparse subgoal sequence，Dense 展示 `full_rollout.mp4`，Uniform 展示均匀子目标模型的生成序列。原先缺失的 All to region Uniform、Canonical shape Dense / Uniform 视频已使用各自最终 checkpoint 生成并补齐。九个 VLP 展示位置暂时使用另一份 Dense checkpoint 新生成的对应视频，按用户要求不显示标题旁的临时标注，真实来源保留在 manifest 和视频无障碍描述中；这不是 VLP 模型输出，表格中的 VLP 数值仍来自论文。补充视频时将对应样例的 `media` 条目从 `null` 改为包含 `video` 和 `poster` 相对路径的对象；缺失数值通过各任务的 `results` 填写。

重新导出可使用 `scripts/export_planning_assets.py`，脚本只读取已有结果，不执行模型推理，也不修改源数据。导出目录必须放在源项目外，例如 `/tmp/`：

```bash
scp scripts/export_planning_assets.py lyg2080:/tmp/export_dreamcan_planning.py
ssh lyg2080 'python3 /tmp/export_dreamcan_planning.py --output /tmp/dreamcan-planning-web'
ssh lyg2080 'tar -czf - -C /tmp/dreamcan-planning-web .' > /tmp/dreamcan-planning-web.tar.gz
mkdir -p assets/experiments/planning
tar -xzf /tmp/dreamcan-planning-web.tar.gz -C assets/experiments/planning
```

VLP 临时素材由 `scripts/generate_planning_placeholder.py` 在 lyg2080 上生成，范围是网页现有的九个样例。输入映射保存在 `assets/experiments/planning/placeholder-jobs.json`：Make a line 使用 Dense-AR step 54000（原 Dense 为 final 106800），All to region 使用 Dense-AR step 42000（原 Dense 为 step 82000），Canonical shape 使用 non-AR Dense step 250000（该训练的 final 为 step 500000）。每条视频直接读取对应 Ours 源目录的 `condition.png` 和原始 `instruction.txt`，使用 320×192、65 帧/call、40 denoising steps、CFG 1.0；前两项分别链式生成 3 / 6 次，Canonical shape 一次生成全任务。每个 round 的 seed 等于 round index，不做搜索或成功样例筛选。原始生成目录为 `/mnt2/gck/newwebsite_planning_placeholders_20261011`，三项任务串行使用 GPU 1，独立加载模型避免 LoRA 权重累加。

每段 `vlp-generation.json`、三份 `<task>-placeholder-generation.json` 和 manifest 保留 checkpoint / 输入像素 / 视频 SHA-256、源路径与完整参数。导入脚本依赖 ffmpeg / ffprobe；本次在 lyg2080 的候选目录完成完整核验，再同步到本地。候选目录需先放入当前 planning 的 `manifest.json`。生成脚本拒绝覆盖已有结果，重新推理应指定新的远程输出目录。重新运行旧素材导出脚本会恢复历史空位，需要随后重新导入临时 VLP 素材和新增 baseline 素材。

```bash
python3 /tmp/import_planning_placeholders.py \
  --generated /mnt2/gck/newwebsite_planning_placeholders_20261011 \
  --planning-root /tmp/dreamcan-placeholder-site-assets-20261011
```

新增 baseline 由 `scripts/generate_planning_baselines.py` 根据 `assets/experiments/planning/baseline-jobs.json` 在 lyg2080 上推理，输出至 `/mnt2/gck/newwebsite_planning_baselines_20261011`。All to region Uniform 使用 step 508000 final，按当前 Ours 的两阶段设置生成，提取每阶段第4、8、…、64帧，共33帧、4fps；Canonical shape Dense 使用 step 500000 final，一次生成65帧、10fps；Canonical shape Uniform 使用 step 638400 final，一次生成并提取16个子目标，加初始帧共17帧、4fps。三项各三个样例，均为对应模型的真实输出，沿用 paired Ours 的初始图像与原始指令，40 steps、CFG 1.0、每阶段 seed 0、无搜索。

基座只加载一次，加载 LoRA 前在 CPU 保存独立的 pristine DiT state；切换 recipe 时先 `load_state_dict(..., strict=True)` 完整恢复，再融合新的 LoRA，避免权重叠加。`scripts/import_planning_baselines.py` 在远端候选目录验证九段视频的 SHA-256、尺寸、帧数、帧率、时长及首帧，再填入空位；已有27个视频和论文表格数值保留。对应 `<task>_<method>-evaluation.json` 和每条 `<method>-generation.json` 保存实际 checkpoint、输入像素 SHA-256 和生成参数。旧 source exporter 会恢复历史空位，需在其后重新导入这两批新素材。

```bash
python3 /tmp/import_planning_baselines.py \
  --jobs /tmp/baseline-jobs.json \
  --generated /mnt2/gck/newwebsite_planning_baselines_20261011 \
  --planning-root /tmp/dreamcan-filled-baseline-site-assets-20261011
```

其余五个实验面板由 `experiments.js` / `experiments.css` 实现，素材位于 `assets/experiments/suite/`。19 个已有视频保持源文件字节、原始帧数和播放速度；新增 Better 演示从源 HDF5 完整导出为 20 fps。manifest 记录来源、SHA-256、分辨率、帧率与指令。Suboptimal 图使用 matplotlib 重绘论文 Figure 5 的已发表数值与误差条；其他科学图保留未调整的原始报告数值。`data/` 保存输入及绘图来源。

- Suboptimal：左侧为论文 Figure 5 的八个 N 点（5/10/20/40/80/120/160/200）及原误差条，采用白底、简洁坐标轴和不同线型/标记；右侧并排播放 Better ep000000（127帧、6.35秒）与 Worse ep000056（1051帧、52.55秒），下方 Findings 展示三条结果分析；图中 DreamCan 使用斯坦福红 #8C1515，Dense 使用蓝色 #1565C0。Better 的 operator_quality、原始像素校验和与来源保存在 `data/square-better-0-source.json`。旧卡片、原始报告对照与 DP 状态图库已从该面板移除。
- Search & Steering：分别展示搜索、语言引导两个子选项卡。搜索图逐条从缓存的 per-frame raw progress 复算，20 个点均为10个初始观测的均值及 SEM；正确区分 sparse best-of-N、anchored、64帧 dense 和192帧 chained dense。预算示例现横排展示1/2/4及第四条media24；第四条按PPT可见标签显示8 calls，内部对象名称32的冲突记录在manifest，实际预算未确认。Language Table 的同初始观测三指令按 slide20 的媒体坐标核对；Packing 的三个附加指令输入 VLM scorer，视频是生成计划而非实机执行。
- Low-level Policy：网络架构图下方并排展示 PushT 与 LIBERO-Long；各含一张重新绘制的参数量 / 成功率散点图和一张 E2E、Dense、Uniform、DreamCan 的三线结果表，均取论文 Table III 的数值。散点图采用 Figure 1 右上角的对数参数量横轴，包含 Ours、VLA-OS、SEER、π0、π0.5 与 Lingbot-VA，DreamCan 为斯坦福红星形。数据及参数统计范围保存于 `data/low-level-results.json`，重绘脚本为 `scripts/plot_low_level_results.py`。原统计卡、两个比较子选项卡和流程条已移除。下方仿真展示现为两行，PushT三条轨迹、LIBERO-Long十个任务各一条，执行与规划视频分开同步；PushT素材来自84% archived run，表格使用论文86%汇总。
- Real World：论文 Table V、三任务视频切换、训练演示量及20次评估；Packing 为110训练组合×5=550演示，95种未见组合用于zero-shot。实机片段保留deck已有4×/3×/4×播放，标记为实机执行。
- Ablation：三个子选项卡是分段可达性、DP三项消融、超越经过时间。首项统一使用 objects-only / 5cm 判据，4100/3950分段试验的task宏均值为97.7%/94.7%，支持T1–T10查看任务和数值；DP项结果81.8/74.2/78.0/83.8/91.2%明确标为论文Table IV，未称原始报告已复核。Square ep103 的 regrasp 数据逐值来自原始缓存，anchor101、drop107、near-anchor208，R=0.80390625、time prior=0.004134526367、状态距离1.383585762cm；detour图保留200条演示、1,406,722个frame pairs的原始中位数和IQR。

核查中发现的论文绘图差异在相关面板的展开说明中写明：`docs/paper/fig_square_scaling.py` 的DP与baselines低层数据不同，Uniform下移5百分点；`fig_tts_search.py` 给dense首尾、anchored末点加减常数，并将dense3换标为Uniform；`fig_staged_per_task_box.py` 用DP objects-only对Uniform objects+eef；`fig_square_reach_shortcut_left.py` 给前四bin的learned estimate加40步。Suboptimal 按最新要求复现已发表 Figure 5，其下移与控制器设置记录在 `data/suboptimal-figure5.json`，不将其描述为重新运行的评估；Test-time search 按最新要求复现已发表 Figure 7，20个点与SEM来自原绘图数据，脚本中的偏移和命名保留在 `data/search-figure7.json`；其余主图继续使用未调整原始数据。论文Tables III–V仍以明确来源的reported values呈现。

`scripts/export_experiment_assets.py` 只读取已有视频、deck媒体及研究暂存报告，使用远程planning环境导出到源项目外的临时目录，不执行模型训练或推理。它的 `--evidence` 需包含 `data/` 保存的六份源输入JSON，`--media-evidence` 使用研究记录的视频映射（对应manifest中的assets及来源）。视频离开视口、离开外层或内层面板时暂停；隐藏面板不加载新的视频源，选例与任务的状态分别保留。当前本地预览仍使用8001端口。

现有suite的 `manifest.json` 也可以直接作为 `--media-evidence` 使用。例如将本地 `assets/experiments/suite/data/`、`manifest.json` 和导出脚本复制至远端临时目录后：

```bash
/data/gck/miniconda3/envs/planning/bin/python /tmp/export_experiment_assets.py \
  --evidence /tmp/experiment-evidence \
  --media-evidence /tmp/experiment-manifest.json \
  --output /tmp/dreamcan-experiment-suite
```

目标：镜像 https://4dcodebench.com/，作为后续学术项目网页的起点。

当前状态：本地预览命令和 GitHub Pages 配置已准备；本地执行环境禁止联网，也禁止创建监听端口，原站文件尚未下载，服务器尚未启动。`index.html` 是明确标注状态的准备页。

## 下载原站

在可联网的终端运行：

```bash
cd /home/gck/Desktop/newwebsite
python3 scripts/mirror.py --download
```

脚本保留原站 HTML、样式和脚本，递归下载同域引用的资源，并将根路径改成相对路径以兼容 GitHub Pages 项目地址。动态拼接的资源路径可能需要补充下载；完成后应使用浏览器 Network 验证图片、视频、数据和交互。外部服务仍依赖网络。下载脚本尚未在联网环境验证。

## 本地预览

```bash
python3 scripts/serve.py
```

默认端口为 8001，访问 http://localhost:8001/ 。可以用 `python3 scripts/serve.py --port 8002` 指定其他端口。

## GitHub Pages

将文件上传至 GitHub 仓库的 `main` 分支，在 Settings → Pages 中选择 GitHub Actions。本仓库的 `.github/workflows/pages.yml` 会上传静态页面，无需 Node 或构建步骤。部署地址为 `https://<用户名>.github.io/<仓库名>/`。

原站内容、作者信息和链接在镜像阶段保留，后续再替换为自己的学术项目内容。

按钮7的补充曲线由服务器使用相同 `selection_curve(c,p,dp_sp,L,min_gap,293,1)` 计算，候选314–344；保存于 `appendedTerminalCurve`，训练K仍为6。末帧344固定选取，其归一化得分为0，星号按实际得分绘制，不移到曲线峰值。图内写明 “Final frame appended after the DP-selected subgoals.”，图外只保留当前初始帧信息与读数。新曲线PNG/PDF已下载到 `outputs/dp_ep000002_k6/`；浏览器已验证真实坐标、悬停联动、离开恢复末帧、切回DP轮次以及手机端布局。

Suboptimal 面板可通过 `scripts/export_suboptimal_panel.py --output <源项目外的新目录>` 在 lyg2080 的 planning 环境重导出。当前导出目录为 `/mnt2/gck/newwebsite_suboptimal_panel_20261011`；将其四个子目录导入 suite，并合并 Better 的 source JSON 到 manifest。该脚本只读取作者 Figure 5 绘图常量与 Square HDF5，不运行训练或推理。

Better / Worse 播放地址与 poster 直接保存在 HTML 的 `data-exp-src` 中，仍按可见性延迟加载并暂停隐藏视频；两段示范不再依赖 suite manifest 请求成功。清单请求采用 no-cache 重新验证，播放脚本版本更新为 `20261012-demo-playback`。已通过清单返回 503 时的独立播放检查。

Test-time search的Fig. 7学术风格重绘由 `scripts/build_search_figure7.py` 生成SVG/PNG/PDF：白底、细坐标轴、log₂横轴、细误差条、无边框双列图例；Ours使用斯坦福红与Abstract蓝，两个baseline用深浅灰及不同marker。保留论文最终点位与SEM，公开来源说明区分论文图与10-observation archived sweep，图旁readout同步为anchored 16 calls / 0.868。已核验20个点、320–1440px布局及Search/Language steering切换，修改限定在该实验面板。

Suboptimal 桌面两栏采用等高网格，图表画布为 6.8 × 7.6 英寸，右侧示范与 Findings 分别顶部、底部对齐；Findings 精简三条表述，保持 Key Results 字体。1000 px 及以下改为单栏。Chromium 核验 1024/1280/1440/1920 px 两栏高度差小于 1 px。

Goal-conditioned low-level policy 面板新增横版 SVG 架构图 `architecture/low-level-policy.svg`，放在结果比较前。基于 lyg2080 最终 LIBERO-Long `goal_resnet_radio_dit` 配置与实现：观测为冻结 RADIO 局部特征 + FiLM-ResNet34 全局特征，子目标经 RADIO / Perceiver 压缩为每帧四个 token，状态 MLP 与语言投影组成 prefix；10 层、512 宽、8 heads 的 flow Transformer 经 adaLN 时间调制输出速度，迭代积分得到16步7维动作块。图下注明具体 LIBERO-Long 实现，PushT 编码器差异记录在 `data/low-level-policy-architecture-source.json`，同时保存四份源文件的 SHA-256。通过 `python3 scripts/draw_low_level_policy.py` 可重建 SVG。手机端在图内水平滚动，可点击打开完整 SVG；已核验320–1920px布局、图像加载、滚动及页面无横向溢出。

低层策略两组结果已核验12个散点数值与8个表格数值；Chromium 检查两幅 SVG 加载、320–1920px布局无横向溢出，以及 PushT / LIBERO stove / LIBERO microwave 三个视频的切换播放。

TTS预算展示已换为用户提供的 `videos/tts/{bad,middle,good}_{0,1,2}.mp4`：三条轨迹各一行，三列对应1 call/no search、4 calls、8 calls。轨迹0/1的指令为top-right→bottom-left对角线，轨迹2为board center竖线；页面按用户指定文字展示。原视频均320×192、4.25秒，保留原文件；`assets/experiments/tts/source.json`记录映射、指令和SHA-256，WebP poster直接抽取原始首帧。已核验9条视频映射、自动播放、隐藏暂停和320–1440px布局。

策略参数散点图纵轴统一从30%开始，画布压缩为6.4×4.5英寸（原6.4×5.8），SVG/PNG及HTML固有尺寸同步；仅调整展示坐标、比例与标签布局，Table III 点位数值保持不变。

TTS第一列现在使用 `assets/experiments/tts/bad_*_annotated.mp4` 展示副本，白色衬底的斯坦福红框线及文字随视频帧出现。traj0/1在末段标注蓝色2→1/2→3；traj2从首个生成帧开始标注蓝色2→1和黄色2→3，异常持续的后续帧保持提示。17帧、4fps、4.25秒及原始320×192尺寸均保留，源视频未改；`annotations.json`保存帧区间、位置和输入/输出SHA-256。全屏播放与拖动均自然保留标注，无额外叠加控件。

traj2的bad展示新增3秒停顿：问题帧1和2各额外重复6帧（1.5秒），合计29帧、4fps、7.25秒；从3.75秒恢复源帧3及之后的正常播放，框线和标注同时消失。独立展示副本为 `bad_2_hold.mp4`，`hold-traj2.json`记录停顿区间与来源，其他轨迹不变。

Real-world Tasks改为三行任务展示，每行左侧并排播放三条PPT成功演示，右侧展示对应任务的Table V成功率（End-to-end、Dense、Uniform、DreamCan）。原总览表格、训练/评估/挑战卡片、成功次数卡片及硬件/播放说明已移除。九条视频直接取自video_dreamcan.pptx第25/27/29页：folding media1/2/34，packing media6/5/35，line media4/3/39。原始嵌入视频不改字节或速度，来源、SHA与首帧poster保存在assets/experiments/real-world/source.json。已核验三行播放、40/65/55%任务成功率、320–1440px布局与隐藏暂停。

仿真展示已拆为两个独立行：PushT 三条轨迹，LIBERO-Long 十个任务各一条。素材与逐条来源保存在 `assets/experiments/suite/simulation/manifest.json`；`policy-simulation.js` 控制两个视图的切换、暂停、进度、速度与循环同步，隐藏面板不加载新视频。执行画面与规划输出是各自的 MP4；PushT 将已有拼接视频拆为1个执行视图和3个真实子目标，LIBERO 将10个真实子目标保留在一行，窄屏在规划区域内部横向滚动。

九个 LIBERO 示例由 lyg2080 的 EXP-A robust step250000 新录制，设置为30步Wan、20步flow、每8步执行重规划、10子目标、600步上限、seed0。benchmark task 8（网页 Task 9）的初始状态0及补录状态3未完成，报告均保存在 `simulation/data/`；网页代表性示例改用 `eval/hiprec/t8_videos_v3` 中已有的成功轨迹，将原2×5网格重排为1×10。该归档的精确checkpoint未从视频目录验证，manifest保留此限制，不将它当作新EXP-A成功。表格仍为论文汇总，不按这十三个示例计算成功率。

生成与导出脚本为 `scripts/generate_policy_rollouts.sh`、`scripts/export_policy_simulation.py`、`scripts/use_archived_libero_task8.py`；导入脚本 `scripts/import_policy_simulation.py` 验证SHA-256、两侧帧数/帧率/时长与规划图宽高比例后生成按钮和页面。源项目只读，推理目录为 `/mnt2/gck/newwebsite_policy_rollouts_20261012_v2`，导出目录为 `/mnt2/gck/newwebsite_policy_simulation_assets_20261012`。为绕过共享磁盘访问停顿，运行配置只将 `data.stats_dir` 改为原训练统计的本地副本；SHA-256为 `01c0ff74732d127fd8ab5ba5834e5ebd5568480ba0d551284e1806bbe20f24bb`。

支持视频进度拖动的新预览为 `http://127.0.0.1:8002/`，由 `python3 scripts/serve_preview.py --port 8002` 提供HTTP字节范围请求。原8001服务保留。Chromium已核验十三个切换项的实际视频/时长/尺寸、暂停和拖动同步、速度/循环同步、面板隐藏恢复，以及320–1920px无页面横向溢出和十个子目标单行排列。

Subgoal reachability面板已按论文Figure 8重绘两组任务小提琴图：左侧DreamCan/Uniform的阶段分布、箱线、stage点和task mean菱形，右侧Experimental setting与Findings。直接从lyg2080读取fig_staged_per_task_box.py指定两份JSON，不改变阶段数值；DreamCan使用objects_only，Uniform使用objects+eef，网页Setting明确这一区别。十任务macro mean为0.97717/0.87664，图显示0.98/0.88；每阶段50试验。生成脚本scripts/build_reachability_figure8.py，输入数据assets/experiments/suite/data/reachability-figure8.json。旧同判据柱图、数字卡片、任务按钮与说明已从该子面板移除；保留文件供追溯。已检查320–1440px布局、其余研究tabs和移除旧读数节点后的JS初始化。

Experimental Results全章配色/版式由experiments-presentation.css局部统一：斯坦福红、Abstract蓝、深色与白底；文字/按钮/选项卡/状态/成功率表格同步，所有数值表采用细横线、红色DreamCan行，去除紫绿橙装饰和图表圆角卡片。主图重绘统一白底/细轴/灰网格/无框legend/DejaVu Sans，保留全部原始曲线、SEM及科学数值，styles脚本不重新训练或推断。search与Figure8调整比例，原生框图同步中性灰与红蓝tint；左右列伸展对齐，实机表格高度跟随视频。中等屏幕留出导航空间，不遮挡图表。搜索说明精简为三个阅读组，保留用户指定Findings；Targets/Train & Eval修正拼写及大小写。各视频、暂停段、切换/播放器行为保留。已验证6个主panel、task/study subtabs、320–1800px无页面横向溢出、导航避让、隐藏暂停、TTS 7.25秒停顿片段。原有实验数据JSON和Experimental Results后续HTML不变；配色/绘图来源与输出SHA记录在data/presentation-style.json。

Real-world Tasks 的九条原录像已添加逐视频离线 DP subgoal sequence：折箱每条15帧，装箱9/12/12帧，摆线每条18帧，共132帧。使用对应任务的 IQL value checkpoint、缓存的 Qwen 指令编码与微调 RoboMeter，在当前录像上重新计算，未套用其他训练轨迹的标注。视频字节与播放速度保留；播放时高亮当前目标，点击缩略图暂停并跳转到该帧。原始数值、选帧索引、checkpoint SHA、DP候选与诊断曲线见 `assets/experiments/real-world/subgoals/`；方法与复现说明见 `assets/experiments/real-world/SUBGOALS.md`。核验了九条视频的跳转/高亮、隐藏暂停及320–1920px布局。
