---
title: 2020-09-01-OC底层:Block+Copy
tags: iOS-OC
---

# 1.copy用途：

- NSString、NSArray、NSDictionary 等等经常使用copy关键字，是因为他们有对应的可变类型：NSMutableString、NSMutableArray、NSMutableDictionary；
- block 也经常使用 copy 关键字，具体原因见[官方文档：Objects Use Properties to Keep Track of Blocks](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/WorkingwithBlocks/WorkingwithBlocks.html#//apple_ref/doc/uid/TP40011210-CH8-SW12)
- block 使用 copy 是从 MRC 遗留下来的“传统”,在 MRC 中,方法内部的 block 是在栈区的,使用 copy 可以把它放到堆区.

# 2.在 ARC 中写不写都行：

 > a.在 ARC 环境下，编译器会根据情況自动将栈上的 block 复制到堆上，比如以下情况：

- block 作为函数返回值时
- 将 block 赋值给 __strong 指针时（property 的 copy 属性对应的是这一条）
- block 作为 Cocoa API 中方法名含有 using Block 的方法参数时
- block 作为 GCD API 的方法参数时

![1](/assets/image/2020-09-01-01.jpg)

> b.其中， block 的 property 设置为 copy， 对应的是这一条：将 block 赋值给 __strong 指针时。换句话说：

- 对于 block 使用 copy 还是 strong 效果是一样的，但写上 copy 也无伤大雅;
- 还能时刻提醒我们：编译器自动对 block 进行了 copy 操作;
- 如果不写 copy ，该类的调用者有可能会忘记或者根本不知道“编译器会自动对 block 进行了 copy 操作”，他们有可能会在调用之前自行拷贝属性值,这种操作多余而低效。你也许会感觉我这种做法有些怪异，不需要写还依然写。如果你这样想，其实是你“日用而不知”，你平时开发中是经常在用我说的这种做法的，比如下面的属性不写copy也行，但是你会选择写还是不写呢？
```C++
@property (nonatomic, copy) NSString *userId;

- (instancetype)initWithUserId:(NSString *)userId {
   self = [super init];
   if (!self) {
       return nil;
   }
   _userId = [userId copy];
   return self;
}
```

![2](/assets/image/2020-09-01-02.jpg)

> ##### c.Translation: 下面做下解释： copy 此特质所表达的所属关系与 strong 类似。然而设置方法并不保留新值，而是将其“拷贝” (copy)。 当属性类型为 NSString 时，经常用此特质来保护其封装性，因为传递给设置方法的新值有可能指向一个 NSMutableString 类的实例。这个类是 NSString 的子类，表示一种可修改其值的字符串，此时若是不拷贝字符串，那么设置完属性之后，字符串的值就可能会在对象不知情的情况下遭人更改。所以，这时就要拷贝一份“不可变” (immutable)的字符串，确保对象中的字符串值不会无意间变动。只要实现属性所用的对象是“可变的” (mutable)，就应该在设置新属性值时拷贝一份。

> d.用 @property 声明 NSString、NSArray、NSDictionary 经常使用 copy 关键字，是因为他们有对应的可变类型：NSMutableString、NSMutableArray、NSMutableDictionary，他们之间可能进行赋值操作，为确保对象中的字符串值不会无意间变动，应该在设置新属性值时拷贝一份。


# 3.深入：
> a.ARC中在block作为属性时用copy修饰是MRC时代的遗留物，是一个习惯问题，提示程序猿这里可能有内存问题。在ARC中用copy保留这个习惯.
在ARC中，copy是可以用strong来代替的。（注意：这里只是说可以,并不推荐，接着往下看...）

block在内存中的存放位置
OC中的三种类型的block：

1. _NSConcreateGlobalBlock 全局的静态block，不会访问任何外部变量。
1. _NSConcreateStackBlock 保存在栈中的block，当函数返回时会被销毁。
1. _NSConcreateMallocBlock 保存在堆区的block，当引用计数为0时被销毁。

> b. block块的存放位置可能在3个地方：

- MRC下：
全局区（代码区）、堆区、栈区

- ARC下：
全局区、堆区
ARC下栈区会自动拷贝到堆区，因此ARC下只有这两个地方

代码区类型block：不访问栈区以外的变量（如局部变量），也不访问堆区的变量（如alloc创建的对象），这种时候block放在代码区；
堆区类型的block：访问了外部变量，此时block存放在堆区；

# 4.总结
1. 对于栈区block，在ARC情况下自动拷贝到堆区，MRC则放在栈区，所在函数执行完毕就会释放。那么要想在外面调用就要用copy指向它，这样就copy到了堆区。
1. strong属性不会拷贝，会造成野指针错区从而crash。另外这里需要注意的是，ARC是编译器的一种特性，编译器在编译的时候会在合适的地方插入retain、release、autorelease，而不是iOS运行时的特性。
1. 堆区是动态的，不像代码区是不变化的，堆区会不断地创建销毁，当没有强指针指向的时候就会被销毁，如果再去访问这段代码，程序就会崩溃。所以在堆区要用strong或者copy修饰。
1. block是一段代码块，即不可变，所以使用copy也不会深copy。
这就可以理解到block的定义:

block：可以理解为匿名的函数，就是预先准备好的一段代码。只不过这段代码里面包含的东西比较多，有isa指针、flags、invoke、descriptor、variables;

所以要用strong替代copy修饰block要满足两个条件：
用strong修饰且引用了外部变量

1. 当ARC下block类型为strong并且引用了外部变量，编译时会自动进行copy（系统帮你进行），block会放在堆区
1. 当ARC下block类型为strong并且没有引用外部变量，block会放在全局区，会变成全局类型。

# 5.另外：
##### 一个block要使用self，会处理成在外部声明一个weak变量指向self，在block里又声明一个strong变量指向weakSelf？？？？？
###### 原因：block会把写在block里的变量copy一份，如果直接在block里使用self，（self对变量默认是强引用）self对block持有，block对self持有，导致循环引用，所以这里需要声明一个弱引用weakSelf，让block引用weakSelf，打破循环引用。
###### 而这样会导致另外一个问题，因为weakSelf是对self的弱引用，如果这个时候控制器pop或者其他的方式引用计数为0，就会释放，如果这个block是异步调用而且调用的时候self已经释放了，这个时候weakSelf已就变成了nil。
###### 当控制器（也可以是其他的控件）pop回来之后（或者一些其他的原因导致释放），网络请求完成，如果这个时候需要控制器做出反映，需要strongSelf再对weakSelf强引用一下。
###### 但是，你可能会疑问，strongSelf对weakSelf强引用，weakSelf对self弱引用，最终不也是对self进行了强引用，会导致循环引用吗。不会的，因为strongSelf是在block里面声明的一个指针，当block执行完毕后，strongSelf会释放，这个时候将不再强引用weakSelf，所以self会正确的释放。
