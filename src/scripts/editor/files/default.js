let list = [1, 2, 3];
let temp = 0;

temp = list[0];
list[0] = list[list.length - 1];
list[list.length - 1] = temp;