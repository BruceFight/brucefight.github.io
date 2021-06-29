---
title: 2021-06-29-Algorithms(DP)
tags: Algorithms
---
```C++
#include <fstream>
#include <iostream>
#include <vector>
#include <numeric>

using namespace std;

int main(int argc, char const *argv[])
{
    
    return 0;
}

/* A ✅  01背包问题
基本思路: 
这是最基础的背包问题，特点是：每种物品仅有一件，可以选择放或不放。
用子问题定义状态：即 F[i, v] 表示前 i 件物品恰放入一个容量为 v 的背包可以获得的最大价值。
则其状态转移方程便是：

    F[i, v] = max{F[i − 1, v], F[i − 1, v − Ci] + Wi}

这个方程非常重要，基本上所有跟背包相关的问题的方程都是由它衍生出来的。
所以有必要将它详细解释一下：“将前 i 件物品放入容量为 v 的背包中”这个子问题，
若只考虑第 i 件物品的策略（放或不放），那么就可以转化为一个只和前 i − 1 件物品相关的问题。
如果不放第 i 件物品，那么问题就转化为“前 i − 1 件物品放入容量为 v 的背包中”，
价值为 F[i − 1, v]；如果放第 i 件物品，那么问题就转化为“前 i − 1 件物品放入剩下的容量为 v − Ci 的背包中”，
此时能获得的最大价值就是 F[i − 1, v − Ci] 再加上通过放入第 i 件物品获得的价值 Wi。
伪代码如下：
F[0, 0..V ] ← 0
for i ← 1 to N
    for v ← Ci to V
        F[i, v] ← max{F[i − 1, v], F[i − 1, v − Ci] + Wi}
*/
// ❌ Lost code

/* B ✅  02台阶问题
 有n阶阶梯, 存在两种登梯方式, 跨1步或者跨2步, 那么一共有几种走完阶梯的方式?
 */
// Code 1
int dp[0];
int find(int n) {
    if (n == 1 || n == 2)
    {
        return n;
    }
    dp[n-1] = find(n-1);
    dp[n-2] = find(n-2);
    dp[n] = dp[n-1] + dp[n-2];
    return dp[n];
}

// Code 2
int find2(int n) {
    if (n <= 2) { return n; }
    vector<int> dp(n, 1);
    for (int i = 2; i <= n; ++i)
    {
        dp[i] = dp[i - 1] + dp[i - 2];
    }
    return dp[n];   
}

/* C ✅  03入室抢劫问题
House Robber, 不能连续抢相邻的房子, 求多最多可以抢多少钱?
例: [0, 299, 29, 10, 33] -> 299, 33 -> 332
*/
int find3(vector<int> a);
void executeFind3() {
    std::vector<int> array;
    array.push_back(0);
    array.push_back(299);
    array.push_back(29);
    array.push_back(10);
    array.push_back(33);
    cout << "抢劫的最大额是" << find3(array) << endl;
}

int find3(vector<int> a) {
    vector<int> dp(a.size(), 0);// 声明结果
    dp[0] = a[0];// 定义边界1
    dp[1] = max(a[0], a[1]);// 定义边界2
    for (int i = 2; i < a.size(); ++i)
    {
        dp[i] = max(dp[i-2] + a[i], dp[i-1]);// 转移方程
    }
    
    return dp[a.size() - 1];
}

/* D ✅  04求数组中的连续等差数组个数
// 给定一个数组，求这个数组中连续且等差的子数组一共有多少个。
// 例: [1,2,3,4] -> [1,2,3], [2,3,4], [1,2,3,4] -> 3个
*/
int find4(vector<int> a) {
    if (a.size() < 3)
    {
        return 0;
    }
    vector<int> dp(a.size(), 0);
    for (int i = 0; i < a.size(); ++i)
    {
        if (a[i-1] == a[i-2])
        {
            dp[i] = dp[i-1] + 1;
        }   
    }
    cout << "个数" << dp.size() << endl;
    return accumulate(dp.begin(), dp.end(), 0);
}
/* ✅ c++知识点:
accumulate函数在头文件 #include <numeric> 里,
主要是用来累加容器里面的值，比如int、string之类，可以少写一个for循环;
比如直接统计 vector<int> v 里面所有元素的和：（第三个参数的0表示sum的初始值为0）
int sum = accumulate(v.begin(), v.end(), 0);
*/

/* E ✅  05切钢条问题,长钢锯断出售
*/
// 一段长度为i的钢条价格为p, 对应的价格表为
//长度i:     1  2  3  4  5  6  7  8  9  10
//对应价格pi: 1  5  8  9  10 17 17 20 24 30
//问题: 对于一段长度为n的钢条, 如何求切割方案, 似的销售收益rn最大.
//对于长度为4的钢条,有如下几种裁剪方式:
// p4 -> (4)
// p3 + p1 -> (3 + 1)
// p2 + p2 -> (2 + 2)
// p2 + p1 + p1 -> (2 + 1 + 1)
// p1 + p1 + p1 + p1 -> (1 + 1 + 1 + 1)
// p1 + p1 + p2 -> (1 + 1 + 2)
// p1 + p2 + p1 -> (1 + 2 + 1)
// p1 + p3 -> (1 + 3)
//解题思路:
//当n<=10是, 按照正常的迭代求最优; 如果n>10, 

int p[] = {0,1,5,8,9,10,17,17,20,24,30};
int findMaxValue(int n) {
    if (n==0) return 0;
    int maxValue = 0;
    if (n<=10)
    {
        for (int i = 1; i <= n; i++)
        {
            maxValue = max(maxValue, p[i] + findMaxValue(n-i));
        }
    } else {
       for (int i = 1; i <= 10; i++)
        {
            maxValue = max(maxValue, p[i] + findMaxValue(n-i));
        } 
    }
    return maxValue;
}
//to be optimized
```