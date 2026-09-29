import csv
import sys

import matplotlib
matplotlib.use('Agg')  # 使用无界面后端，保存图片时不会弹窗或报错
import matplotlib.pyplot as plt

# 设置中文字体，避免标题和图例里的中文显示为方框
plt.rcParams['font.sans-serif'] = ['PingFang SC', 'Hiragino Sans GB', 'Arial Unicode MS', 'SimHei']
plt.rcParams['axes.unicode_minus'] = False  # 正常显示负号


def judge(temperature, humidity):
    """根据温度和湿度返回状态，规则与 M1 前端保持一致（温度优先）。"""
    if temperature <= 18:
        return '偏冷'
    if temperature >= 30:
        return '偏热'
    if humidity >= 75:
        return '偏湿'
    return '正常'


# 读取 CSV 文件
# 注意：导出的 CSV 开头带有 BOM（用于让 Excel 正确识别中文），
# 用 encoding='utf-8-sig' 读取会自动去掉 BOM，避免表头变成 "﻿time"
with open('../data/dormmate.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# 把温度和湿度转成 float，并重新按统一规则判断状态（不依赖 CSV 里的 status 字段）
records = []
for row in rows:
    temperature = float(row['temperature'])
    humidity = float(row['humidity'])
    records.append({
        'time': row['time'],
        'temperature': temperature,
        'humidity': humidity,
        'status': judge(temperature, humidity),
    })

# 没有数据时直接提示并退出
if not records:
    print('总记录数：0，没有数据可供统计')
    sys.exit(0)

# 统计最高/最低温度、湿度
temperatures = [r['temperature'] for r in records]
humidities = [r['humidity'] for r in records]

max_temperature = max(temperatures)
min_temperature = min(temperatures)
max_humidity = max(humidities)
min_humidity = min(humidities)

# 统计各状态数量
status_counts = {'正常': 0, '偏冷': 0, '偏热': 0, '偏湿': 0}
for r in records:
    status_counts[r['status']] += 1

# 需要关注的记录（状态不是"正常"）
attention = [r for r in records if r['status'] != '正常']

# 打印统计结果（:g 让浮点数按需显示，去掉多余的 .0）
print(f'总记录数：{len(records)}')
print(f'最高温度：{max_temperature:g}℃，最低温度：{min_temperature:g}℃')
print(f'最高湿度：{max_humidity:g}%，最低湿度：{min_humidity:g}%')

print('状态统计：')
for status, count in status_counts.items():
    print(f'  {status}：{count} 条')

print('需要关注的记录：')
if attention:
    for r in attention:
        print(f"  {r['time']} | {r['temperature']:g}℃ | {r['humidity']:g}% | {r['status']}")
else:
    print('  无')

# 绘制温湿度趋势图
# X 轴用序号（time 可能很长，用 1,2,3... 更清晰）
x = list(range(1, len(records) + 1))

plt.figure()
plt.plot(x, temperatures, 'ro-', label='温度（℃）')   # 红色温度线
plt.plot(x, humidities, 'bo-', label='湿度（%）')     # 蓝色湿度线

plt.title('温湿度趋势图')
plt.xlabel('序号')
plt.ylabel('数值')
plt.legend()

# 保存图片并关闭，避免重复运行时占用内存
plt.savefig('../report/trend.png', dpi=100, bbox_inches='tight')
plt.close()

# 生成 HTML 报告（所有数据由 CSV 动态生成，不写死）
# 状态统计的列表项
status_items = ''
for status, count in status_counts.items():
    status_items += f'      <li>{status}：{count} 条</li>\n'

# 需要关注的记录列表项
attention_items = ''
if attention:
    for r in attention:
        attention_items += (
            f"      <li>{r['time']} | {r['temperature']:g}℃ | "
            f"{r['humidity']:g}% | {r['status']}</li>\n"
        )
else:
    attention_items = '      <li>无</li>\n'

# CSS 样式（普通字符串，非 f-string，避免花括号与占位符冲突）
css = '''
      body {
        font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
        max-width: 720px;
        margin: 0 auto;
        padding: 24px;
        color: #1f2937;
        background: #f8fafc;
      }
      h1 {
        text-align: center;
        color: #1e40af;
      }
      h2 {
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 8px;
        margin-top: 28px;
      }
      p, li {
        font-size: 15px;
        line-height: 1.9;
      }
      ul {
        padding-left: 22px;
      }
      img {
        max-width: 100%;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
      }
'''

# 拼装完整 HTML
html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>DormMate 环境报告</title>
  <style>{css}</style>
</head>
<body>
  <h1>DormMate 环境报告</h1>

  <h2>摘要</h2>
  <p>总记录数：{len(records)}</p>
  <p>最高温度：{max_temperature:g}℃，最低温度：{min_temperature:g}℃</p>
  <p>最高湿度：{max_humidity:g}%，最低湿度：{min_humidity:g}%</p>

  <h2>状态统计</h2>
  <ul>
{status_items}  </ul>

  <h2>需要关注的记录</h2>
  <ul>
{attention_items}  </ul>

  <h2>温湿度趋势图</h2>
  <img src="trend.png" alt="温湿度趋势图">
</body>
</html>
'''

# 写入报告文件
with open('../report/report.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('报告已生成：../report/report.html')
