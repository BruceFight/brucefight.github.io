---
title: 2020-09-08-OC底层:NSCache
tags: iOS-OC
---

NSCache使用很方便，提供了类似可变字典的实现方式，但它比可变字典更适用于实现缓存。

最重要的原因是NSCache是线程安全的，使用NSMutableDictionary自定义实现缓存的时候需要考虑加锁和释放锁，NSCache已经帮我们做好了这一步。
其次，内存不足时NSCache会自动释放存储的对象，不需要手动干预，如果是自定义实现需要监听内存状态然后做进一步删除对象的操作。
还有一点NSCache的键key不会被复制，所以key不需要实现NSCopying协议。
以上三点就是NSCache相比于NSMutableDictionary实现缓存功能的优点，在需要实现缓存的时候应优先考虑使用NSCache。


NSCache删除缓存中的对象会在以下情形中发生。

NSCache缓存对象自身被释放
手动调用removeObjectForKey:方法
手动调用removeAllObjects
缓存中对象的个数大于countLimit，或，缓存中对象的总cost值大于totalCostLimit
程序进入后台后
收到系统的内存警告