---
title: 2020-09-02-OC底层:Mutable+Copy
tags: iOS-OC
---

# 用@property声明的NSString（或NSArray，NSDictionary）经常使用copy关键字，为什么？如果改用strong关键字，可能造成什么问题？
> 因为父类指针可以指向子类对象,使用 copy 的目的是为了让本对象的属性不受外界影响,使用 copy 无论给我传入是一个可变对象还是不可对象,我本身持有的就是一个不可变的副本.
> 如果我们使用是 strong ,那么这个属性就有可能指向一个可变对象,如果这个可变对象在外部被修改了,那么会影响该属性.
> copy 此特质所表达的所属关系与 strong 类似。然而设置方法并不保留新值，而是将其“拷贝” (copy)。 当属性类型为 NSString 时，经常用此特质来保护其封装性，因为传递给设置方法的新值有可能指向一个 NSMutableString 类的实例。这个类是 NSString 的子类，表示一种可修改其值的字符串，此时若是不拷贝字符串，那么设置完属性之后，字符串的值就可能会在对象不知情的情况下遭人更改。所以，这时就要拷贝一份“不可变” (immutable)的字符串，确保对象中的字符串值不会无意间变动。只要实现属性所用的对象是“可变的” (mutable)，就应该在设置新属性值时拷贝一份。

##### A.举例说明：
```
/// 1.定义一个以 strong 修饰的 array：
@property (nonatomic, readwrite, strong) NSArray *array;
/// 2.然后进行下面的操作：

   NSArray *array = @[ @1, @2, @3, @4 ];
   NSMutableArray *mutableArray = [NSMutableArray arrayWithArray:array];
   
   self.array = mutableArray;
   [mutableArray removeAllObjects];;
   NSLog(@"%@",self.array);
   
   [mutableArray addObjectsFromArray:array];
   self.array = [mutableArray copy];
   [mutableArray removeAllObjects];;
   NSLog(@"%@",self.array);

/// 3.打印结果如下所示：

2015-09-27 19:10:32.523 CYLArrayCopyDmo[10681:713670] (
)
2015-09-27 19:10:32.524 CYLArrayCopyDmo[10681:713670] (
   1,
   2,
   3,
   4
)
```

##### B.为了理解这种做法，首先要知道，两种情况：

> ###### 1. 对非集合类对象的copy与mutableCopy：
> 在非集合类对象中：对 immutable 对象进行 copy 操作，是指针复制，mutableCopy 操作时内容复制；对 mutable 对象进行 copy 和 mutableCopy 都是内容复制。用代码简单表示如下：

[immutableObject copy] // 浅复制
[immutableObject mutableCopy] //深复制
[mutableObject copy] //深复制
[mutableObject mutableCopy] //深复制
比如以下代码：

NSMutableString *string = [NSMutableString stringWithString:@"origin"];//copy
NSString *stringCopy = [string copy];
查看内存，会发现 string、stringCopy 内存地址都不一样，说明此时都是做内容拷贝、深拷贝。即使你进行如下操作：

[string appendString:@"origion!"]
stringCopy 的值也不会因此改变，但是如果不使用 copy，stringCopy 的值就会被改变。 集合类对象以此类推。 所以，

用 @property 声明 NSString、NSArray、NSDictionary 经常使用 copy 关键字，是因为他们有对应的可变类型：NSMutableString、NSMutableArray、NSMutableDictionary，他们之间可能进行赋值操作，为确保对象中的字符串值不会无意间变动，应该在设置新属性值时拷贝一份。

> ###### 2、对集合类对象的copy与mutableCopy:
> 集合类对象是指 NSArray、NSDictionary、NSSet ... 之类的对象。下面先看集合类immutable对象使用 copy 和 mutableCopy 的一个例子：

```
NSArray *array = @[@[@"a", @"b"], @[@"c", @"d"]];
NSArray *copyArray = [array copy];
NSMutableArray *mCopyArray = [array mutableCopy];
/// 查看内存，可以看到 copyArray 和 array 的地址是一样的，而 mCopyArray 和 array 的地址是不同的。说明 copy 操作进行了指针拷贝，mutableCopy 进行了内容拷贝。但需要强调的是：此处的内容拷贝，仅仅是拷贝 array 这个对象，array 集合内部的元素仍然是指针拷贝。这和上面的非集合 immutable 对象的拷贝还是挺相似的，那么mutable对象的拷贝会不会类似呢？我们继续往下，看 mutable 对象拷贝的例子：

NSMutableArray *array = [NSMutableArray arrayWithObjects:[NSMutableString stringWithString:@"a"],@"b",@"c",nil];
NSArray *copyArray = [array copy];
NSMutableArray *mCopyArray = [array mutableCopy];
/// 查看内存，如我们所料，copyArray、mCopyArray和 array 的内存地址都不一样，说明 copyArray、mCopyArray 都对 array 进行了内容拷贝。同样，我们可以得出结论：
```
在集合类对象中，对 immutable 对象进行 copy，是指针复制， mutableCopy 是内容复制；对 mutable 对象进行 copy 和 mutableCopy 都是内容复制。但是：集合对象的内容复制仅限于对象本身，对象元素仍然是指针复制。用代码简单表示如下：

[immutableObject copy] // 浅复制
[immutableObject mutableCopy] //单层深复制
[mutableObject copy] //单层深复制
[mutableObject mutableCopy] //单层深复制
这个代码结论和非集合类的非常相似。

