---
title: 2020-09-08-OC底层:NSCache
tags: iOS-OC
---

# NSCache
NSCache是苹果提供的一套缓存机制，用法和NSMutableDictionary类似，在AFNetworking，SDWebImage，Kingfisher中都有用到。

# NSCache和NSMutableDictionary的区别
- NSCache是线程安全的，不需要加线程锁，而NSMutableDictionary线程不安全。
> 线程安全和锁: http://blog.csdn.net/Hello_Hwc/article/details/50037505?ref=myread
- 当内存不足时NSCache会自动释放内存
- NSCache设置缓存对象数量和占用的内存大小，当缓存超出了设置会自动释放内存
- NSCache是Key-Value数据结构，其中key是强引用，不实现NSCoping协议，作为key的对象不会被拷贝

# NSCache的属性
- countLimit: 能够缓存对象的最大数量，默认值是0，没有限制（限制是不精/不严格的）。
- totalCostLimit: 设置缓存占用的内存大小（限制是不精/不严格的）
- evictsObjectsWithDiscardedContent: 是否回收废弃内容，默认YES

# NSCache的方法
- objectForKey: 通过key获得缓存对象
- setObject: forKey: 缓存对象
- setObject: forKey: cost: 缓存对象，并指定key值对应的成本，用于计算缓存中所有对象的总成本
- removeObjectForKey: 删除指定对象
- removeAllObjects: 删除所有缓存对象

# NSCacheDelegate代理
willEvictObject: 缓存对象即将被清理时调用，一般开发者用来调试，不能在此方法中修改缓存. 在下列场景中会被调用：
> removeObjectForKey
> 缓存对象超过NSCache的countLimit和otalCostLimit属性设置的限制
> App进入后台
> 系统发出内存警告
> cache这个实例的生命周期结束

# NSCache需要注意的点
- 当收到内存警告，而我们又调用removeAllObjects，则无法再继续往缓存中添加数据
- 不提供缓存总的大小，想知道NSCache占用的内存大小，只有通过添加缓存的cost自己计算
- NSCache自动释放内存的算法是不确定的， 有时是按照LRU(最近最久未使用)释放，有时随机释放
- NSCache中的数据在APP重启后会消失，因为NSCache只是将数据保存在内存